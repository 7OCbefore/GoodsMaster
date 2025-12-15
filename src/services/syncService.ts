import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';
import { db } from '../db';
import type { Package, SalesOrder, Product } from '../types/domain';

class SyncService {
  private isSyncing = false;

  /**
   * 将单条数据推送到云端 (Push Single Item)
   * 包含字段映射逻辑：Frontend (camelCase) -> DB (snake_case)
   */
  async pushToCloud(table: 'packages' | 'sales' | 'products', data: any) {
    if (!isSupabaseConfigured || !supabase) {
      console.warn('Sync skipped: Supabase not configured');
      return;
    }

    try {
      const user = await getCurrentUser();
      const timestamp = new Date().toISOString();

      // 公共字段
      const commonFields = {
        user_id: user.id,
        updated_at: timestamp,
        is_deleted: data.is_deleted || false
      };

      let tableName = '';
      let payload = {};

      // --- 核心：字段映射 (Mapping) ---
      if (table === 'packages') {
        tableName = 'packages';
        const pkg = data as Package;
        payload = {
          ...commonFields,
          id: pkg.id, // ID
          product_id: pkg.productId, // [关键] 映射 productId -> product_id
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
          items: sale.items, // JSONB 直接存
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
          created_at: prod.created_at || timestamp // 补全创建时间
        };
      }

      // 执行 Upsert
      const { error } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;
      
    } catch (error) {
      console.error(`Push to cloud failed for ${table}:`, error);
      // 在真实系统中，这里应该将失败任务加入重试队列
    }
  }

  /**
   * 从云端拉取数据 (Pull All Data)
   * 包含反向映射逻辑：DB (snake_case) -> Frontend (camelCase)
   */
  async pullFromCloud() {
    if (!isSupabaseConfigured || !supabase) return;

    this.isSyncing = true;
    try {
      const user = await getCurrentUser();

      // 1. 并行拉取所有表的数据
      const [productsRes, packagesRes, salesRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).eq('is_deleted', false),
        supabase.from('packages').select('*').eq('user_id', user.id).eq('is_deleted', false),
        supabase.from('sales').select('*').eq('user_id', user.id).eq('is_deleted', false)
      ]);

      if (productsRes.error) throw productsRes.error;
      if (packagesRes.error) throw packagesRes.error;
      if (salesRes.error) throw salesRes.error;

      // 2. 开启 Dexie 事务进行批量写入
      await db.transaction('rw', db.products, db.packages, db.sales, async () => {
        // 先清空本地 (简单粗暴的同步策略，适合单人模式)
        // 优化建议：如果是多人协作，这里应该做 Diff 比较
        await db.products.clear();
        await db.packages.clear();
        await db.sales.clear();

        // 写入 Products
        if (productsRes.data?.length) {
          await db.products.bulkAdd(productsRes.data as unknown as Product[]);
        }

        // 写入 Packages (需映射字段)
        if (packagesRes.data?.length) {
          const mappedPackages = packagesRes.data.map((row: any) => ({
            id: row.id,
            productId: row.product_id, // [关键] 反向映射
            batchId: row.batch_id,
            tracking: row.tracking,
            content: row.content,
            quantity: row.quantity,
            costPrice: row.cost_price,
            note: row.note,
            verified: row.verified,
            timestamp: row.timestamp,
            // 本地不需要 user_id, updated_at 等字段，Dexie 会自动忽略或你可以显式剔除
          }));
          await db.packages.bulkAdd(mappedPackages as unknown as Package[]);
        }

        // 写入 Sales (需映射字段)
        if (salesRes.data?.length) {
          const mappedSales = salesRes.data.map((row: any) => ({
            id: row.id,
            timestamp: row.timestamp,
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
      console.error('Pull from cloud failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 全量备份 (Backup All)
   * 必须严格遵守写入顺序：Products -> Packages -> Sales
   */
  async backupToCloud() {
    if (!isSupabaseConfigured || !supabase || this.isSyncing) return;
    
    this.isSyncing = true;
    try {
      // 1. 读取本地所有数据
      const [localProducts, localPackages, localSales] = await Promise.all([
        db.products.toArray(),
        db.packages.toArray(),
        db.sales.toArray()
      ]);

      console.log(`Starting backup: ${localProducts.length} products, ${localPackages.length} packages...`);

      // 2. [Step 1] 同步 Products (主数据)
      // 必须先同步这个，否则 Packages 的 product_id 外键会报错
      for (const prod of localProducts) {
        await this.pushToCloud('products', prod);
      }

      // 3. [Step 2] 同步 Packages (事务数据)
      // 使用 for...of 循环串行发送，或者 Promise.all 并发发送
      // 为了稳定性，这里使用分批并发 (Batching) 会更好，但为保持代码简洁，暂时用 Promise.all
      const packagePromises = localPackages.map(pkg => this.pushToCloud('packages', pkg));
      await Promise.all(packagePromises);

      // 4. [Step 3] 同步 Sales
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