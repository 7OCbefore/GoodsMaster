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

class GoodsMasterDB extends Dexie {
  packages!: Dexie.Table<PackageRecord, string>; // 主键为string类型的id
  sales!: Dexie.Table<OrderRecord, string>; // 主键为string类型的id
  goods!: Dexie.Table<GoodsRecord, number>; // 主键为自增id
  sellPrices!: Dexie.Table<SellPriceRecord, number>; // 主键为自增id
  products!: Dexie.Table<ProductRecord, string>; // 主键为string类型的id (UUID)
  snapshots!: Dexie.Table<SnapshotRecord, number>; // 主键为自增id
  deleted_records!: Dexie.Table<DeletedRecord, string>; // 主键为string类型的id

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
  }
}

// 创建单例数据库实例
export const db = new GoodsMasterDB();

// 类型已通过接口导出