import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';
import { db } from '../db';
import type { Package, Order, Product } from '../types/domain';
import type { DeletedRecord } from '../db/index';
import { createUuid } from '../utils/uuid';

// 同步选项接口
interface SyncOptions {
  pruneLocallyDeleted: boolean; // true = 标准同步 (剪枝), false = 恢复模式
  forceFullPull: boolean;       // true = 拉取所有云端数据, false = 仅增量
}

class SyncService {
  private isSyncing = false;

  /**
   * [核心修复] 聚合同步方法
   * 策略：先备份本地数据到云端 (Push)，再拉取云端最新数据 (Pull)
   * 这保证了本地的新修改不会因为 Pull 操作的"清空重写"逻辑而丢失
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
      // 执行标准同步（带剪枝）
      await this.executeSync({ pruneLocallyDeleted: true, forceFullPull: false });

      console.log('✅ Sync completed successfully!');
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 执行同步 - 支持剪枝和恢复模式
   * @param options 同步选项
   */
  async executeSync(options: SyncOptions) {
    const forceFullPull = options.pruneLocallyDeleted ? true : options.forceFullPull;
    
    // 1. Push Upserts (始终执行)
    await this.backupToCloudInternal(false); // false 表示不重复设置 isSyncing

    // 2. Push Deletes (剪枝 - 条件执行)
    if (options.pruneLocallyDeleted) {
      await this.pushLocalDeletions();
    }

    // 3. Pull (拉取)
    await this.pullCloudChanges(forceFullPull, options.pruneLocallyDeleted);
    
    // 4. Update Sync Timestamp
    localStorage.setItem('last_sync_time', new Date().toISOString());
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
          id: pkg.id, // uuid
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
        const sale = data as Order;
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

  /**
   * 推送删除逻辑 (Pruning Logic)
   */
  private async pushLocalDeletions() {
    if (!supabase) return;

    // 获取所有待删除记录
    const pendingDeletes = await db.deleted_records.toArray();
    if (pendingDeletes.length === 0) return;

    // 按表分组
    const groups: Record<string, DeletedRecord[]> = {};
    for (const record of pendingDeletes) {
      if (!groups[record.tableName]) {
        groups[record.tableName] = [];
      }
      groups[record.tableName].push(record);
    }

    for (const [tableName, records] of Object.entries(groups)) {
      const ids = records.map(r => r.id);
      
      // 调用 Supabase RPC 或 Update
      // UPDATE tableName SET is_deleted = true, last_modified = now() WHERE id IN (ids)
      const { error } = await supabase
        .from(tableName)
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in('id', ids);

      if (!error) {
        // 只有云端确认标记为删除后，才移除本地墓碑
        await db.deleted_records.bulkDelete(ids);
      }
    }
  }

  /**
   * 拉取与恢复逻辑 (Pull & Restore Logic)
   * @param forceFull 是否强制全量拉取
   * @param isPruningMode 是否为剪枝模式
   */
  private async pullCloudChanges(forceFull: boolean, isPruningMode: boolean) {
    if (!supabase) return;
    
    const user = await getCurrentUser();
    const lastSync = localStorage.getItem('last_sync_time');
    const tables = ['products', 'packages', 'sales'];

    for (const tableName of tables) {
      let query = supabase.from(tableName).select('*').eq('user_id', user.id).eq('is_deleted', false);
      
      // 如果不是强制全量，则仅拉取增量
      if (!forceFull && lastSync) {
        query = query.gt('updated_at', lastSync);
      }

      const { data, error } = await query;
      if (error || !data) continue;

      await db.transaction('rw', db.table(tableName), db.deleted_records, async () => {
        // 在剪枝模式下，直接覆盖数据
        if (isPruningMode) {
          // 清空本地表数据
          await db.table(tableName).clear();
          
          // 插入云端数据
          if (data.length > 0) {
            if (tableName === 'products') {
              const mappedProducts = data.map((row: any) => ({
                id: row.id,
                user_id: row.user_id,
                name: row.name,
                barcode: row.barcode,
                price: row.price,
                stock_warning: row.stock_warning,
                category: row.category,
                created_at: row.created_at,
                updated_at: row.updated_at,
                is_deleted: row.is_deleted
              }));
              await db.products.bulkAdd(mappedProducts as unknown as Product[]);
            } else if (tableName === 'packages') {
              const mappedPackages = data.map((row: any) => ({
                id: row.id,
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
            } else if (tableName === 'sales') {
              const mappedSales = data.map((row: any) => ({
                id: row.id,
                timestamp: Number(row.timestamp),
                customer: row.customer,
                totalAmount: row.total_amount,
                totalProfit: row.total_profit,
                items: row.items,
                status: row.status,
                note: row.note
              }));
              await db.sales.bulkAdd(mappedSales as unknown as Order[]);
            }
          }
        } else {
          // 在恢复模式下，需要检查是否有恢复的数据
          // 写入数据
          if (data.length > 0) {
            if (tableName === 'products') {
              const mappedProducts = data.map((row: any) => ({
                id: row.id,
                user_id: row.user_id,
                name: row.name,
                barcode: row.barcode,
                price: row.price,
                stock_warning: row.stock_warning,
                category: row.category,
                created_at: row.created_at,
                updated_at: row.updated_at,
                is_deleted: row.is_deleted
              }));
              await db.products.bulkPut(mappedProducts as unknown as Product[]);
            } else if (tableName === 'packages') {
              const mappedPackages = data.map((row: any) => ({
                id: row.id,
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
              await db.packages.bulkPut(mappedPackages as unknown as Package[]);
            } else if (tableName === 'sales') {
              const mappedSales = data.map((row: any) => ({
                id: row.id,
                timestamp: Number(row.timestamp),
                customer: row.customer,
                totalAmount: row.total_amount,
                totalProfit: row.total_profit,
                items: row.items,
                status: row.status,
                note: row.note
              }));
              await db.sales.bulkPut(mappedSales as unknown as Order[]);
            }
          }
          
          // 检查这些数据是否在"待删除列表"中 (如果是，说明是误删恢复)
          const restoredIds = data.map((d: any) => d.id);
          // 从 deleted_records 中移除这些 ID，防止下次同步时又把它们删了
          await db.deleted_records
            .where('tableName').equals(tableName)
            .and(r => restoredIds.includes(r.id))
            .delete();
        }
      });
    }
  }

  // 内部拉取逻辑 - 保持原有功能向后兼容
  private async pullFromCloudInternal(manageState = true) {
    return this.pullCloudChanges(true, true);
  }

  // 公开的拉取方法
  async pullFromCloud() {
    return this.pullFromCloudInternal(true);
  }

  /**
   * 从云端恢复数据（不执行剪枝操作）
   */
  async recoverFromCloud() {
    // 执行恢复模式同步（不剪枝 + 恢复）
    await this.executeSync({ pruneLocallyDeleted: false, forceFullPull: true });
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
            const newId = createUuid();
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

  /**
   * 软删除记录（替代直接的物理删除）
   * @param id 记录ID
   * @param tableName 表名
   */
  async softDeleteRecord(id: string, tableName: string) {
    // 记录墓碑（用于同步剪枝）
    await db.deleted_records.put({
      id,
      tableName,
      deletedAt: Date.now()
    });
    
    // 物理删除本地业务数据（为了节省本地空间和UI逻辑）
    await db.table(tableName).delete(id);
  }
}

export const syncService = new SyncService();
