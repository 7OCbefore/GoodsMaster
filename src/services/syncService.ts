import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';
import { db } from '../db';
import type { Package, SalesOrder, Product } from '../types/domain';

// 简单的 UUID 生成器 (符合 RFC4122 v4)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class SyncService {
  private isSyncing = false;

  /**
   * 核心：推送单条数据 (Push Single Item)
   */
  async pushToCloud(table: 'packages' | 'sales' | 'products', data: any) {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const user = await getCurrentUser();
      const timestamp = new Date().toISOString();

      const commonFields = {
        user_id: user.id,
        updated_at: timestamp,
        is_deleted: data.is_deleted || false
      };

      let tableName = '';
      let payload = {};

      if (table === 'packages') {
        tableName = 'packages';
        const pkg = data as Package;
        
        // [安全守卫] 如果没有 productId，绝对不能上传，否则数据库报错
        if (!pkg.productId) {
           throw new Error(`Package ${pkg.content} is missing productId. Skipping.`);
        }

        payload = {
          ...commonFields,
          id: pkg.id, // numeric
          product_id: pkg.productId, // UUID
          batch_id: pkg.batchId,
          tracking: pkg.tracking,
          content: pkg.content,
          quantity: pkg.quantity,
          cost_price: pkg.costPrice,
          note: pkg.note,
          verified: pkg.verified,
          timestamp: pkg.timestamp
        };
      } else if (table === 'sales') {
        tableName = 'sales';
        const sale = data as SalesOrder;
        payload = {
          ...commonFields,
          id: sale.id, // numeric
          customer: sale.customer,
          total_amount: sale.totalAmount,
          total_profit: sale.totalProfit,
          items: sale.items,
          status: sale.status,
          note: sale.note,
          timestamp: sale.timestamp
        };
      } else if (table === 'products') {
        tableName = 'products';
        const prod = data as Product;
        payload = {
          ...commonFields,
          id: prod.id, // UUID
          name: prod.name,
          barcode: prod.barcode,
          price: prod.price,
          stock_warning: prod.stock_warning,
          category: prod.category,
          created_at: prod.created_at || timestamp
        };
      }

      const { error } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error(`Supabase error for ${table} ID ${data.id}:`, error.message);
        throw error;
      }
      
    } catch (error) {
      // 抛出错误以便上层捕获
      throw error;
    }
  }

  /**
   * 拉取数据 (Pull) - 反向映射
   */
  async pullFromCloud() {
    if (!isSupabaseConfigured || !supabase) return;

    this.isSyncing = true;
    try {
      const user = await getCurrentUser();

      const [productsRes, packagesRes, salesRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).eq('is_deleted', false),
        supabase.from('packages').select('*').eq('user_id', user.id).eq('is_deleted', false),
        supabase.from('sales').select('*').eq('user_id', user.id).eq('is_deleted', false)
      ]);

      if (productsRes.error) throw productsRes.error;
      if (packagesRes.error) throw packagesRes.error;
      if (salesRes.error) throw salesRes.error;

      await db.transaction('rw', db.products, db.packages, db.sales, async () => {
        await db.products.clear();
        await db.packages.clear();
        await db.sales.clear();

        if (productsRes.data?.length) {
          await db.products.bulkAdd(productsRes.data as unknown as Product[]);
        }

        if (packagesRes.data?.length) {
          const mappedPackages = packagesRes.data.map((row: any) => ({
            id: Number(row.id), // 转回 Number
            productId: row.product_id, 
            batchId: row.batch_id,
            tracking: row.tracking,
            content: row.content,
            quantity: row.quantity,
            costPrice: row.cost_price,
            note: row.note,
            verified: row.verified,
            timestamp: Number(row.timestamp),
          }));
          await db.packages.bulkAdd(mappedPackages as unknown as Package[]);
        }

        if (salesRes.data?.length) {
          const mappedSales = salesRes.data.map((row: any) => ({
            id: Number(row.id),
            timestamp: Number(row.timestamp),
            customer: row.customer,
            totalAmount: row.total_amount,
            totalProfit: row.total_profit,
            items: row.items,
            status: row.status,
            note: row.note
          }));
          await db.sales.bulkAdd(mappedSales as unknown as SalesOrder[]);
        }
      });

      console.log('☁️ Cloud sync completed successfully');
    } catch (error) {
      console.error('Pull failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 智能全量备份 (Smart Backup with Auto-Hydration)
   */
  async backupToCloud() {
    if (!isSupabaseConfigured || !supabase || this.isSyncing) return;
    
    this.isSyncing = true;
    try {
      // 1. 读取本地数据
      const [localProducts, localPackages, localSales] = await Promise.all([
        db.products.toArray(),
        db.packages.toArray(),
        db.sales.toArray()
      ]);

      console.log(`🚀 Starting backup: ${localProducts.length} Prods, ${localPackages.length} Pkgs`);

      // 2. 建立索引：商品名 -> UUID
      const productNameToIdMap = new Map<string, string>();
      const existingProductIds = new Set<string>();

      // 先上传所有已知商品
      for (const prod of localProducts) {
        await this.pushToCloud('products', prod);
        productNameToIdMap.set(prod.name, prod.id);
        existingProductIds.add(prod.id);
      }

      // 3. 智能上传 Packages (自动创建缺失商品)
      for (const pkg of localPackages) {
        let fixedPkg = { ...pkg };
        let needsUpdateInLocalDB = false;

        // 情况A: 缺少 productId
        // 情况B: 有 productId，但这个 ID 在 products 表里不存在 (孤儿引用)
        const isOrphan = pkg.productId && !existingProductIds.has(pkg.productId);

        if (!pkg.productId || isOrphan) {
          console.log(`🔧 Fixing orphan package: ${pkg.content}`);
          
          // 尝试按名字查找
          let foundId = productNameToIdMap.get(pkg.content);

          // 如果连名字都找不到，创建一个新商品！
          if (!foundId) {
            const newId = generateUUID();
            const newProduct: Product = {
              id: newId,
              name: pkg.content, // 使用包里的商品名
              price: 0, // 默认价格
              stock_warning: 5,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_deleted: false
            };
            
            // 立即上传这个新商品
            console.log(`✨ Auto-creating missing product: ${pkg.content} (${newId})`);
            await this.pushToCloud('products', newProduct);
            
            // 更新索引
            productNameToIdMap.set(newProduct.name, newId);
            existingProductIds.add(newId);
            
            // 同时也存入本地 DB，防止下次还缺
            await db.products.put(newProduct);
            
            foundId = newId;
          }

          // 修复 Package 引用
          fixedPkg.productId = foundId;
          needsUpdateInLocalDB = true;
        }

        // 如果我们在内存里修复了数据，顺便也更新一下本地 DB，保持一致性
        if (needsUpdateInLocalDB) {
           await db.packages.put(fixedPkg);
        }

        // 上传修复后的 Package
        await this.pushToCloud('packages', fixedPkg);
      }

      // 4. 上传 Sales
      const salesPromises = localSales.map(sale => this.pushToCloud('sales', sale));
      await Promise.all(salesPromises);

      console.log('✅ Full backup completed!');
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncService = new SyncService();