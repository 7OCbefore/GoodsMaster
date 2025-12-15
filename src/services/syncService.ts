import { supabase, isSupabaseConfigured } from './supabase';
import { db } from '../db';
import { Package, Order } from '../types/domain';

class SyncService {
  private isSyncing = false;
  
  async pushToCloud(table: 'packages' | 'sales', data: any) {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, skipping sync');
      return;
    }

    if (!supabase) {
      console.error('Supabase client is null despite being configured');
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.warn('User not authenticated, skipping sync');
        return;
      }

      // 添加用户ID和时间戳
      const userData = {
        ...data,
        user_id: user.data.user.id,
        updated_at: new Date().toISOString(),
        is_deleted: false
      };

      // 根据表名调用相应的插入操作
      let result;
      if (table === 'packages') {
        result = await supabase
          .from('packages')
          .upsert(userData, { onConflict: ['id'] });
      } else if (table === 'sales') {
        result = await supabase
          .from('sales')
          .upsert(userData, { onConflict: ['id'] });
      }

      if (result.error) {
        console.error(`Error syncing ${table} to cloud:`, result.error);
        throw result.error;
      }
    } catch (error) {
      console.error(`Sync error for ${table}:`, error);
      throw error;
    }
  }

  async pullFromCloud() {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, skipping sync');
      return;
    }

    if (!supabase) {
      console.error('Supabase client is null despite being configured');
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.warn('User not authenticated, skipping sync');
        return;
      }

      // 获取云端数据，使用增量同步（仅获取比本地最后同步时间更新的数据）
      // 这里暂时实现全量拉取，后续可以优化为增量同步
      const { data: packagesData, error: packagesError } = await supabase
        .from('packages')
        .select('*')
        .eq('user_id', user.data.user.id)
        .is('is_deleted', false) // 只获取未删除的数据
        .order('updated_at', { ascending: false });

      if (packagesError) {
        console.error('Error fetching packages from cloud:', packagesError);
        throw packagesError;
      }

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('user_id', user.data.user.id)
        .is('is_deleted', false) // 只获取未删除的数据
        .order('updated_at', { ascending: false });

      if (salesError) {
        console.error('Error fetching sales from cloud:', salesError);
        throw salesError;
      }

      // 清空本地数据并插入云端数据
      await db.packages.clear();
      await db.sales.clear();

      if (packagesData && packagesData.length > 0) {
        await db.packages.bulkPut(packagesData);
      }

      if (salesData && salesData.length > 0) {
        await db.sales.bulkPut(salesData);
      }
      
      console.log('Successfully synced data from cloud');
    } catch (error) {
      console.error('Pull sync error:', error);
      throw error;
    }
  }

  async sync() {
    if (!isSupabaseConfigured || this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    try {
      await this.pullFromCloud();
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }
  
  // 同步本地数据到云端（全量备份功能）
  async backupToCloud() {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, skipping backup');
      return;
    }

    if (!supabase) {
      console.error('Supabase client is null despite being configured');
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.warn('User not authenticated, skipping backup');
        return;
      }

      // 获取本地所有数据
      const [localPackages, localSales] = await Promise.all([
        db.packages.toArray(),
        db.sales.toArray()
      ]);

      // 同步packages
      if (localPackages.length > 0) {
        const packagesForSync = localPackages.map(pkg => ({
          ...pkg,
          user_id: user.data.user!.id,
          updated_at: new Date().toISOString(),
          is_deleted: false
        }));

        const { error: packagesError } = await supabase
          .from('packages')
          .upsert(packagesForSync, { onConflict: ['id'] });

        if (packagesError) {
          console.error('Error backing up packages:', packagesError);
          throw packagesError;
        }
      }

      // 同步sales
      if (localSales.length > 0) {
        const salesForSync = localSales.map(sale => ({
          ...sale,
          user_id: user.data.user!.id,
          updated_at: new Date().toISOString(),
          is_deleted: false
        }));

        const { error: salesError } = await supabase
          .from('sales')
          .upsert(salesForSync, { onConflict: ['id'] });

        if (salesError) {
          console.error('Error backing up sales:', salesError);
          throw salesError;
        }
      }

      console.log(`Backup completed: ${localPackages.length} packages, ${localSales.length} sales`);
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  }
}

export const syncService = new SyncService();