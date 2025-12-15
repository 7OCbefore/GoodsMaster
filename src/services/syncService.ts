import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';
import { db } from '../db';
import type { Package, SalesOrder, Product } from '../types/domain';

// 简单的 UUID 生成器
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class SyncService {
  private isSyncing = false;

  /**
   * [核心修复] 聚合同步方法
   * 策略：先备份本地数据到云端 (Push)，再拉取云端最新数据 (Pull)
   * 这保证了本地的新修改不会因为 Pull 操作的“清空重写”逻辑而丢失
   */
  async sync() {
    if (this.isSyncing) return;
    
    // 检查配置
    if (!isSupabaseConfigured || !supabase) {
      console.warn('Sync skipped: Supabase not configured');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting Smart Sync...');

    try {
      // 1. 先把本地数据安全地送上云端 (Backup/Push)
      // 这一步包含了 "孤儿数据修复" 逻辑
      await this.backupToCloudInternal(false); // false 表示不重复设置 isSyncing

      // 2. 再拉取云端完整数据，刷新本地 (Pull/Refresh)
      // 这一步会确保本地和云端完全一致
      await this.pullFromCloudInternal(false);

      console.log('✅ Sync completed successfully!');
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // --- 内部实现方法 (Internal Methods) ---

  async pushToCloud(table: 'packages' | 'sales' | 'products', data: any) {
    if (!supabase) return;

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
        
        // 安全守卫：如果没有 productId，跳过或报错
        // (backupToCloud 会自动修复这个问题，所以这里只是最后的防线)
        if (!pkg.productId) {
           console.warn(`Skipping package ${pkg.id} due to missing productId`);
           return; 
        }

        payload = {
          ...commonFields,
          id: pkg.id, // numeric
          product_id: pkg.productId, // snake_case 映射
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
          id: sale.id,
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
          id: prod.id,
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

      if (error) throw error;
      
    } catch (error) {
      throw error;
    }
  }

  // 内部拉取逻辑
  private async pullFromCloudInternal(manageState = true) {
    if (!supabase) return;
    if (manageState) this.isSyncing = true;

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
            id: Number(row.id),
            productId: row.product_id, // 反向映射
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
    } finally {
      if (manageState) this.isSyncing = false;
    }
  }

  // 公开的拉取方法
  async pullFromCloud() {
    return this.pullFromCloudInternal(true);
  }

  // 内部备份逻辑 (包含自动修复孤儿数据)
  private async backupToCloudInternal(manageState = true) {
    if (!supabase) return;
    if (manageState) this.isSyncing = true;
    
    try {
      const [localProducts, localPackages, localSales] = await Promise.all([
        db.products.toArray(),
        db.packages.toArray(),
        db.sales.toArray()
      ]);

      console.log(`🚀 Backing up: ${localProducts.length} Prods, ${localPackages.length} Pkgs`);

      const productNameToIdMap = new Map<string, string>();
      const existingProductIds = new Set<string>();

      // 1. Upload Products & Build Index
      for (const prod of localProducts) {
        await this.pushToCloud('products', prod);
        productNameToIdMap.set(prod.name, prod.id);
        existingProductIds.add(prod.id);
      }

      // 2. Upload Packages (with Auto-Hydration)
      const packagePromises = localPackages.map(async (pkg) => {
        let fixedPkg = { ...pkg };
        let needsUpdateInLocalDB = false;

        const isOrphan = pkg.productId && !existingProductIds.has(pkg.productId);

        if (!pkg.productId || isOrphan) {
          // 尝试修复缺失的关联
          let foundId = productNameToIdMap.get(pkg.content);

          if (!foundId) {
            // 自动创建新商品
            const newId = generateUUID();
            const newProduct: Product = {
              id: newId,
              name: pkg.content,
              price: 0,
              stock_warning: 5,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_deleted: false,
              user_id: '' // pushToCloud 会自动填充
            };
            
            console.log(`✨ Auto-creating product: ${pkg.content}`);
            await this.pushToCloud('products', newProduct);
            
            productNameToIdMap.set(newProduct.name, newId);
            existingProductIds.add(newId);
            
            // 本地存入新商品
            await db.products.put(newProduct);
            foundId = newId;
          }

          fixedPkg.productId = foundId;
          needsUpdateInLocalDB = true;
        }

        if (needsUpdateInLocalDB) {
           await db.packages.put(fixedPkg);
        }

        return this.pushToCloud('packages', fixedPkg);
      });
      
      await Promise.all(packagePromises);

      // 3. Upload Sales
      const salesPromises = localSales.map(sale => this.pushToCloud('sales', sale));
      await Promise.all(salesPromises);

    } finally {
      if (manageState) this.isSyncing = false;
    }
  }

  // 公开的备份方法
  async backupToCloud() {
    return this.backupToCloudInternal(true);
  }
}

export const syncService = new SyncService();