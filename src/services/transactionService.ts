/**
 * 事务管理服务
 * 确保关键业务操作的原子性和一致性
 */

import { db } from '../db/index';
import { operationLogService } from './operationLogService';
import { Package, Order, Product } from '../types/domain';

/**
 * 事务结果
 */
interface TransactionResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  operationId?: string;
}

/**
 * 事务执行函数类型
 */
type TransactionFunc<T> = () => Promise<T>;

/**
 * 事务管理服务类
 */
class TransactionService {
  /**
   * 执行事务操作
   */
  async execute<T>(
    operationName: string,
    func: TransactionFunc<T>,
    rollbackFunc?: TransactionFunc<void>
  ): Promise<TransactionResult<T>> {
    const startTime = Date.now();
    const operationId = `tx_${startTime}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 开始事务: ${operationName} (${operationId})`);
      }

      // 开始事务
      const result = await db.transaction('rw', [
        db.packages,
        db.sales,
        db.products,
        db.operations,
        db.deleted_records
      ], async () => {
        // 执行事务逻辑
        const result = await func();
        return result;
      });

      // 记录事务成功日志
      await operationLogService.logOperation(
        'transactions',
        operationId,
        'INSERT',
        {
          operationName,
          duration: Date.now() - startTime,
          success: true
        }
      );

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ 事务完成: ${operationName} (${Date.now() - startTime}ms)`);
      }

      return {
        success: true,
        data: result,
        operationId
      };
    } catch (error) {
      // 记录事务失败日志
      await operationLogService.logOperation(
        'transactions',
        operationId,
        'INSERT',
        {
          operationName,
          duration: Date.now() - startTime,
          success: false,
          error: (error as Error).message
        }
      );

      // 执行回滚逻辑（如果提供）
      if (rollbackFunc) {
        try {
          await rollbackFunc();
        } catch (rollbackError) {
          console.error('事务回滚失败:', rollbackError);
        }
      }

      console.error(`❌ 事务失败: ${operationName}`, error);

      return {
        success: false,
        error: error as Error,
        operationId
      };
    }
  }

  /**
   * 创建销售订单（事务性操作）
   * 确保库存扣减和订单创建要么都成功，要么都失败
   */
  async createSalesOrderAtomic(order: Order): Promise<TransactionResult<Order>> {
    return this.execute(
      'createSalesOrder',
      async () => {
        // 1. 验证库存
        await this.validateInventory(order);

        // 2. 扣减库存
        await this.deductInventory(order);

        // 3. 创建销售订单
        await db.sales.put(order);

        // 4. 记录操作日志
        await operationLogService.logOperation('sales', order.id, 'INSERT', order);

        return order;
      },
      async () => {
        // 回滚：删除订单
        await db.sales.delete(order.id);
      }
    );
  }

  /**
   * 订单退款（事务性操作）
   * 确保库存恢复和订单状态更新要么都成功，要么都失败
   */
  async refundOrderAtomic(orderId: string): Promise<TransactionResult<Order>> {
    return this.execute(
      'refundOrder',
      async () => {
        // 1. 获取订单
        const order = await db.sales.get(orderId);
        if (!order) {
          throw new Error(`订单不存在: ${orderId}`);
        }

        if (order.status === 'refunded') {
          throw new Error('订单已退款');
        }

        // 2. 恢复库存
        await this.restoreInventory(order);

        // 3. 更新订单状态
        const updatedOrder = { ...order, status: 'refunded' as const };
        await db.sales.put(updatedOrder);

        // 4. 记录操作日志
        await operationLogService.logOperation('sales', orderId, 'UPDATE', updatedOrder);

        return updatedOrder;
      },
      async () => {
        // 回滚：恢复订单状态
        const order = await db.sales.get(orderId);
        if (order) {
          const originalOrder = { ...order, status: 'completed' as const };
          await db.sales.put(originalOrder);
        }
      }
    );
  }

  /**
   * 添加进货（事务性操作）
   * 确保进货记录和库存更新要么都成功，要么都失败
   */
  async addPackageAtomic(pkg: Package): Promise<TransactionResult<Package>> {
    return this.execute(
      'addPackage',
      async () => {
        // 1. 创建进货记录
        const packageId = pkg.id || this.generateId();
        const newPackage = { ...pkg, id: packageId };
        await db.packages.put(newPackage);

        // 2. 记录操作日志
        await operationLogService.logOperation('packages', packageId, 'INSERT', newPackage);

        return newPackage;
      },
      async () => {
        // 回滚：删除进货记录
        if (pkg.id) {
          await db.packages.delete(pkg.id);
        }
      }
    );
  }

  /**
   * 删除商品（事务性操作）
   * 确保商品删除和关联数据清理要么都成功，要么都失败
   */
  async deleteProductAtomic(productId: string): Promise<TransactionResult<void>> {
    return this.execute(
      'deleteProduct',
      async () => {
        // 1. 检查是否有关联的进货记录
        const relatedPackages = await db.packages
          .where('productId')
          .equals(productId)
          .toArray();

        if (relatedPackages.length > 0) {
          throw new Error(`无法删除商品，还有 ${relatedPackages.length} 条关联进货记录`);
        }

        // 2. 软删除商品（标记为删除）
        const product = await db.products.get(productId);
        if (product) {
          const deletedProduct = { ...product, is_deleted: true };
          await db.products.put(deletedProduct);

          // 3. 记录操作日志
          await operationLogService.logOperation('products', productId, 'DELETE', product);

          // 4. 记录删除追踪
          await db.deleted_records.put({
            id: productId,
            tableName: 'products',
            deletedAt: Date.now()
          });
        }
      },
      async () => {
        // 回滚：恢复商品状态
        const product = await db.products.get(productId);
        if (product) {
          const originalProduct = { ...product, is_deleted: false };
          await db.products.put(originalProduct);
        }
      }
    );
  }

  /**
   * 验证库存是否充足
   */
  private async validateInventory(order: Order): Promise<void> {
    for (const item of order.items) {
      // 获取当前库存
      const packages = await db.packages
        .where('productId')
        .equals(item.productId || '')
        .and(p => p.verified)
        .toArray();

      const currentStock = packages.reduce((sum, pkg) => sum + pkg.quantity, 0);

      // 获取已销售数量（排除退款）
      const sales = await db.sales
        .where('id')
        .noneOf([]) // 这里应该查询相关订单
        .toArray();

      // 计算可销售数量
      const availableStock = currentStock; // 简化计算

      if (availableStock < item.quantity) {
        throw new Error(`商品 "${item.name}" 库存不足，需要 ${item.quantity}，可用 ${availableStock}`);
      }
    }
  }

  /**
   * 扣减库存
   */
  private async deductInventory(order: Order): Promise<void> {
    for (const item of order.items) {
      // 获取所有已验证的进货记录
      const packages = await db.packages
        .where('productId')
        .equals(item.productId || '')
        .and(p => p.verified)
        .sortBy('timestamp'); // 按时间排序，先进先出

      let remainingToDeduct = item.quantity;

      // 依次扣减库存
      for (const pkg of packages) {
        if (remainingToDeduct <= 0) break;

        if (pkg.quantity <= remainingToDeduct) {
          // 扣减整个批次
          remainingToDeduct -= pkg.quantity;
          await db.packages.update(pkg.id, { quantity: 0 });
        } else {
          // 部分扣减
          await db.packages.update(pkg.id, {
            quantity: pkg.quantity - remainingToDeduct
          });
          remainingToDeduct = 0;
        }
      }

      if (remainingToDeduct > 0) {
        throw new Error(`商品 "${item.name}" 库存扣减失败，剩余 ${remainingToDeduct}`);
      }

      // 记录操作日志
      await operationLogService.logOperation(
        'packages',
        item.productId || '',
        'UPDATE',
        { deducted: item.quantity, orderId: order.id }
      );
    }
  }

  /**
   * 恢复库存
   */
  private async restoreInventory(order: Order): Promise<void> {
    for (const item of order.items) {
      // 创建补货记录
      const restorePackage = {
        id: this.generateId(),
        content: item.name,
        productId: item.productId,
        quantity: item.quantity,
        costPrice: item.costSnapshot,
        verified: true,
        timestamp: Date.now(),
        note: `退款补货 - 订单 ${order.id}`
      };

      await db.packages.put(restorePackage);

      // 记录操作日志
      await operationLogService.logOperation(
        'packages',
        restorePackage.id,
        'INSERT',
        restorePackage
      );
    }
  }

  /**
   * 生成ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取事务统计信息
   */
  async getTransactionStats(hours: number = 24): Promise<{
    total: number;
    success: number;
    failure: number;
    averageDuration: number;
  }> {
    try {
      const since = Date.now() - (hours * 60 * 60 * 1000);
      const operations = await db.operations
        .where('table')
        .equals('transactions')
        .and(op => op.timestamp >= since)
        .toArray();

      const total = operations.length;
      const success = operations.filter(op => op.data?.success).length;
      const failure = total - success;
      const averageDuration = operations.length > 0
        ? operations.reduce((sum, op) => sum + (op.data?.duration || 0), 0) / operations.length
        : 0;

      return { total, success, failure, averageDuration };
    } catch (error) {
      console.error('获取事务统计信息失败:', error);
      return { total: 0, success: 0, failure: 0, averageDuration: 0 };
    }
  }
}

// 创建单例实例
export const transactionService = new TransactionService();
