import Dexie from 'dexie';
import { Order, Package, Goods } from '../types/domain';

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
  snapshots!: Dexie.Table<SnapshotRecord, number>; // 主键为自增id

  constructor() {
    super('GoodsMasterDB');

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
  }
}

// 创建单例数据库实例
export const db = new GoodsMasterDB();

// 类型已通过接口导出