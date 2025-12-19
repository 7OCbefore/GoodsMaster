import Dexie from 'dexie';
import { Order, Package, Goods, Product } from '../types/domain';

// 扩展接口以支持Dexie的索引属性
export interface PackageRecord extends Package {
  id: string; // 确保id为必填，用于主键
}

export interface OrderRecord extends Order {
  // 已经包含id字段
}

export interface GoodsRecord {
  id?: number; // 自增id
  name: string; // 商品名称
}

export interface SellPriceRecord {
  id?: number; // 自增id
  goodsName: string; // 商品名称
  price: number; // 销售价格
}

export interface ProductRecord extends Product {
  // 继承Product接口的所有字段
}

// 墓碑记录接口，用于追踪本地删除操作
export interface DeletedRecord {
  id: string; // 被删除记录的 UUID
  tableName: string; // 'products' | 'packages' | 'sales'
  deletedAt: number; // 删除时间戳
}

// 快照表（未来扩展用）
export interface SnapshotRecord {
  id?: number;
  date: number; // 时间戳
  type: 'inventory' | 'financial';
  data: unknown; // 快照数据
}

// 操作日志表（用于精确同步）
export interface OperationLog {
  id: string; // UUID
  table: string; // 表名：'packages' | 'products' | 'sales'
  recordId: string; // 记录ID
  operation: 'INSERT' | 'UPDATE' | 'DELETE'; // 操作类型
  timestamp: number; // 操作时间戳
  checksum: string; // 数据校验和（防篡改）
  user_id?: string; // 用户ID（多租户支持）
  data?: any; // 操作时的数据快照（可选，用于回滚）
}

class GoodsMasterDB extends Dexie {
  packages!: Dexie.Table<PackageRecord, string>; // 主键为string类型的id
  sales!: Dexie.Table<OrderRecord, string>; // 主键为string类型的id
  goods!: Dexie.Table<GoodsRecord, number>; // 主键为自增id
  sellPrices!: Dexie.Table<SellPriceRecord, number>; // 主键为自增id
  products!: Dexie.Table<ProductRecord, string>; // 主键为string类型的id (UUID)
  snapshots!: Dexie.Table<SnapshotRecord, number>; // 主键为自增id
  deleted_records!: Dexie.Table<DeletedRecord, string>; // 主键为string类型的id
  operations!: Dexie.Table<OperationLog, string>; // 主键为string类型的id (UUID)

  constructor() {
    super('GoodsMasterDB');

    // 版本1：初始数据库结构
    this.version(1).stores({
      // packages表：id为主键，索引batchId、timestamp、verified用于快速查询
      packages: 'id, batchId, timestamp, verified',
      // sales表：id为主键，索引timestamp、status用于日期筛选和状态查询
      sales: 'id, timestamp, status',
      // goods表：自增id为主键，name字段唯一索引，确保商品名不重复
      goods: '++id, &name',
      // sellPrices表：自增id为主键，goodsName索引用于快速查找商品价格
      sellPrices: '++id, goodsName',
      // snapshots表：自增id为主键，索引date和type用于按日期和类型查询快照
      snapshots: '++id, date, type'
    });

    // 版本2：添加云端同步所需的字段
    this.version(2).stores({
      // packages表：添加updated_at字段用于同步
      packages: 'id, batchId, timestamp, verified, updated_at',
      // sales表：添加updated_at字段用于同步
      sales: 'id, timestamp, status, updated_at',
      // goods表保持不变
      goods: '++id, &name',
      // sellPrices表保持不变
      sellPrices: '++id, goodsName',
      // snapshots表保持不变
      snapshots: '++id, date, type'
    }).upgrade((transaction) => {
      // 当升级到版本2时，为现有数据添加updated_at字段
      return Promise.all([
        // 为packages表中的所有记录添加updated_at字段
        transaction.table('packages').toCollection().modify(pkg => {
          if (!pkg.updated_at) {
            pkg.updated_at = new Date().toISOString();
          }
        }),
        // 为sales表中的所有记录添加updated_at字段
        transaction.table('sales').toCollection().modify(sale => {
          if (!sale.updated_at) {
            sale.updated_at = new Date().toISOString();
          }
        })
      ]);
    });

    // 版本3：引入Product主数据模型
    this.version(3).stores({
      // 添加products表，id为主键，name和updated_at索引用于查询和同步
      products: 'id, name, updated_at, user_id',
      // packages表保持不变，productId字段不加索引（可选字段）
      packages: 'id, batchId, timestamp, verified, updated_at',
      // sales表保持不变
      sales: 'id, timestamp, status, updated_at',
      // goods表保持不变（向后兼容）
      goods: '++id, &name',
      // sellPrices表保持不变（向后兼容）
      sellPrices: '++id, goodsName',
      // snapshots表保持不变
      snapshots: '++id, date, type'
    });

    // 版本4：添加删除记录追踪表
    this.version(4).stores({
      // 添加deleted_records表，用于追踪本地删除操作
      deleted_records: 'id, tableName, deletedAt',
      // products表保持不变
      products: 'id, name, updated_at, user_id',
      // packages表保持不变
      packages: 'id, batchId, timestamp, verified, updated_at',
      // sales表保持不变
      sales: 'id, timestamp, status, updated_at',
      // goods表保持不变（向后兼容）
      goods: '++id, &name',
      // sellPrices表保持不变（向后兼容）
      sellPrices: '++id, goodsName',
      // snapshots表保持不变
      snapshots: '++id, date, type'
    });

    // 版本5：Schema索引优化 - 提升查询性能
    this.version(5).stores({
      // 优化packages表：添加productId索引和复合索引
      // [productId+timestamp]: 支持按商品ID和时间范围查询
      // [verified+timestamp]: 支持筛选已验证记录并按时间排序
      packages: 'id, productId, batchId, timestamp, verified, updated_at, [productId+timestamp], [verified+timestamp]',
      // 优化products表：添加复合索引
      // [user_id+updated_at]: 支持多租户下的高效查询
      products: 'id, name, updated_at, user_id, [user_id+updated_at]',
      // 优化sales表：添加复合索引
      // [timestamp+status]: 支持按状态和时间范围查询
      sales: 'id, timestamp, status, updated_at, [timestamp+status]',
      // 其他表保持不变
      goods: '++id, &name',
      sellPrices: '++id, goodsName',
      deleted_records: 'id, tableName, deletedAt',
      snapshots: '++id, date, type'
    }).upgrade((transaction) => {
      // 升级到版本5时，为现有数据添加缺失的索引字段
      return Promise.all([
        // 为packages表添加productId索引（如果缺失）
        transaction.table('packages').toCollection().modify(pkg => {
          if (!pkg.productId) {
            pkg.productId = undefined; // 保持为undefined直到数据修复
          }
        }),
        // 为products表确保user_id字段存在
        transaction.table('products').toCollection().modify(product => {
          if (!product.user_id) {
            product.user_id = 'default-user'; // 为现有数据设置默认用户ID
          }
        })
      ]);
    });

    // 版本6：操作日志表 - 支持精确同步
    this.version(6).stores({
      // 新增operations表：支持基于操作日志的精确同步
      // id: UUID主键
      // table: 表名索引，用于快速查询特定表的操作
      // [table+timestamp]: 复合索引，支持按表和时间查询操作历史
      // [table+recordId]: 复合索引，支持查询特定记录的操作历史
      operations: 'id, table, recordId, timestamp, [table+timestamp], [table+recordId]',
      // 其他表保持不变
      packages: 'id, productId, batchId, timestamp, verified, updated_at, [productId+timestamp], [verified+timestamp]',
      products: 'id, name, updated_at, user_id, [user_id+updated_at]',
      sales: 'id, timestamp, status, updated_at, [timestamp+status]',
      goods: '++id, &name',
      sellPrices: '++id, goodsName',
      deleted_records: 'id, tableName, deletedAt',
      snapshots: '++id, date, type'
    });
  }
}

// 创建单例数据库实例
export const db = new GoodsMasterDB();

// 类型已通过接口导出