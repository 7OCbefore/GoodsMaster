/**
 * 操作日志服务
 * 记录所有数据变更操作，支持精确同步和审计
 */

import { db, OperationLog } from '../db/index';

/**
 * 生成数据校验和（简单实现）
 * 实际生产环境应使用更安全的哈希算法
 */
function generateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return hash.toString(16);
}

/**
 * 操作日志服务类
 */
class OperationLogService {
  /**
   * 记录操作日志
   */
  async logOperation(
    table: string,
    recordId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    data?: any,
    user_id?: string
  ): Promise<void> {
    try {
      const operationLog: OperationLog = {
        id: this.generateOperationId(),
        table,
        recordId,
        operation,
        timestamp: Date.now(),
        checksum: generateChecksum(data || {}),
        user_id: user_id || 'default-user',
        data: data ? JSON.parse(JSON.stringify(data)) : undefined // 深拷贝
      };

      await db.operations.add(operationLog);

      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 记录操作日志: ${operation} ${table} ${recordId}`);
      }
    } catch (error) {
      console.error('记录操作日志失败:', error);
      // 操作日志失败不应影响主业务
    }
  }

  /**
   * 获取指定时间戳之后的操作日志
   */
  async getOperationsSince(timestamp: number, table?: string): Promise<OperationLog[]> {
    try {
      if (table) {
        // 查询特定表的操作
        return await db.operations
          .where('[table+timestamp]')
          .between([table, timestamp], [table, Date.now()])
          .toArray();
      } else {
        // 查询所有表的操作
        return await db.operations
          .where('timestamp')
          .above(timestamp)
          .toArray();
      }
    } catch (error) {
      console.error('获取操作日志失败:', error);
      return [];
    }
  }

  /**
   * 获取特定记录的操作历史
   */
  async getOperationsForRecord(table: string, recordId: string): Promise<OperationLog[]> {
    try {
      return await db.operations
        .where('[table+recordId]')
        .equals([table, recordId])
        .toArray();
    } catch (error) {
      console.error('获取记录操作历史失败:', error);
      return [];
    }
  }

  /**
   * 获取最后一次同步的操作ID
   */
  async getLastSyncedOperationId(): Promise<string | null> {
    try {
      const operations = await db.operations
        .orderBy('timestamp')
        .reverse()
        .limit(1)
        .toArray();

      return operations.length > 0 ? operations[0].id : null;
    } catch (error) {
      console.error('获取最后同步操作ID失败:', error);
      return null;
    }
  }

  /**
   * 清理指定时间之前的操作日志
   */
  async cleanupOperations(beforeTimestamp: number): Promise<number> {
    try {
      const count = await db.operations
        .where('timestamp')
        .below(beforeTimestamp)
        .count();

      await db.operations
        .where('timestamp')
        .below(beforeTimestamp)
        .delete();

      if (process.env.NODE === 'development') {
        console.log(`🧹 清理了 ${count} 条操作日志`);
      }

      return count;
    } catch (error) {
      console.error('清理操作日志失败:', error);
      return 0;
    }
  }

  /**
   * 验证操作日志完整性
   */
  async verifyOperationIntegrity(operationLog: OperationLog): Promise<boolean> {
    try {
      if (!operationLog.data) {
        return true; // 没有数据快照的记录默认通过验证
      }

      const currentChecksum = generateChecksum(operationLog.data);
      return currentChecksum === operationLog.checksum;
    } catch (error) {
      console.error('验证操作日志完整性失败:', error);
      return false;
    }
  }

  /**
   * 获取操作统计信息
   */
  async getOperationStats(hours: number = 24): Promise<{
    total: number;
    byType: Record<string, number>;
    byTable: Record<string, number>;
  }> {
    try {
      const since = Date.now() - (hours * 60 * 60 * 1000);
      const operations = await this.getOperationsSince(since);

      const stats = {
        total: operations.length,
        byType: {} as Record<string, number>,
        byTable: {} as Record<string, number>
      };

      operations.forEach(op => {
        // 按类型统计
        stats.byType[op.operation] = (stats.byType[op.operation] || 0) + 1;

        // 按表统计
        stats.byTable[op.table] = (stats.byTable[op.table] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('获取操作统计信息失败:', error);
      return { total: 0, byType: {}, byTable: {} };
    }
  }

  /**
   * 生成操作ID（基于时间戳和随机数）
   */
  private generateOperationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `op_${timestamp}_${random}`;
  }

  /**
   * 批量记录操作日志（提高性能）
   */
  async batchLogOperations(
    operations: Array<{
      table: string;
      recordId: string;
      operation: 'INSERT' | 'UPDATE' | 'DELETE';
      data?: any;
      user_id?: string;
    }>
  ): Promise<void> {
    try {
      const operationLogs: OperationLog[] = operations.map(op => ({
        id: this.generateOperationId(),
        table: op.table,
        recordId: op.recordId,
        operation: op.operation,
        timestamp: Date.now(),
        checksum: generateChecksum(op.data || {}),
        user_id: op.user_id || 'default-user',
        data: op.data ? JSON.parse(JSON.stringify(op.data)) : undefined
      }));

      await db.operations.bulkAdd(operationLogs);

      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 批量记录了 ${operationLogs.length} 条操作日志`);
      }
    } catch (error) {
      console.error('批量记录操作日志失败:', error);
    }
  }

  /**
   * 重放操作日志（用于数据恢复）
   */
  async replayOperations(operations: OperationLog[]): Promise<void> {
    for (const op of operations) {
      try {
        // 验证操作日志完整性
        const isValid = await this.verifyOperationIntegrity(op);
        if (!isValid) {
          console.warn(`操作日志验证失败，跳过: ${op.id}`);
          continue;
        }

        // 根据操作类型执行相应操作
        switch (op.operation) {
          case 'INSERT':
            await db.table(op.table).put({ id: op.recordId, ...op.data });
            break;
          case 'UPDATE':
            await db.table(op.table).update(op.recordId, op.data);
            break;
          case 'DELETE':
            await db.table(op.table).delete(op.recordId);
            break;
        }
      } catch (error) {
        console.error(`重放操作日志失败: ${op.id}`, error);
      }
    }
  }
}

// 创建单例实例
export const operationLogService = new OperationLogService();

// 定期清理旧的操作日志（保留30天）
setInterval(async () => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  await operationLogService.cleanupOperations(thirtyDaysAgo);
}, 24 * 60 * 60 * 1000); // 每24小时执行一次
