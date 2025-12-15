export interface OrderItem {
  name: string;
  productId?: string; // 关联到 Product.id
  quantity: number;
  sellPrice: number;
  costSnapshot: number;
}

export interface Order {
  id: string;
  timestamp: number;
  items: OrderItem[];
  totalAmount: number;
  totalProfit: number;
  status: 'completed' | 'refunded';
  note?: string;
  updated_at?: string;  // 同步时间戳
  user_id?: string;     // 用户ID（云端）
}

export interface Package {
  id?: string;
  batchId?: string;
  tracking?: string;
  content: string;
  productId?: string; // 关联到 Product.id
  quantity: number;
  costPrice: number;
  note?: string;
  verified: boolean;
  timestamp: number;
  updated_at?: string;  // 同步时间戳
  user_id?: string;     // 用户ID（云端）
}

export type Goods = string;

export interface InventoryItem {
  name: string;
  quantity: number;
  averageCost: number;
}

export interface DailyStats {
  revenue: number;
  profit: number;
  count: number;
  aov: number;
  marginRate: string;
  orders: Order[];
}

export interface ChartData {
  labels: { label: string; active: boolean }[];
  values: number[];
  revenueValues: number[];
  max: number;
}

export interface Product {
  id: string; // UUID
  user_id: string; // Global User ID
  name: string;
  barcode?: string; // 条码
  price: number; // 零售价
  stock_warning: number; // 预警阈值
  category?: string;
  updated_at: string;
  is_deleted: boolean;
}