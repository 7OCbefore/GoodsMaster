export interface OrderItem {
  name: string;
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
}

export interface Package {
  id?: string;
  batchId?: string;
  tracking?: string;
  content: string;
  quantity: number;
  costPrice: number;
  note?: string;
  verified: boolean;
  timestamp: number;
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