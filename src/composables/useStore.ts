import { ref, computed, watch } from 'vue';
import Decimal from 'decimal.js';
import { Package, Order, InventoryItem, DailyStats, ChartData, Goods } from '../types/domain';
import { db } from '../db/index';

// --- 单例状态 ---
const packages = ref<Package[]>([]);
const goodsList = ref<Goods[]>([]);
const salesHistory = ref<Order[]>([]);
const sellPrice = ref<Record<string, number>>({});

// 全局选中的日期 (用于 Dashboard 时间旅行)
const selectedDate = ref<Date>(new Date());

// 加载状态
const isLoading = ref<boolean>(false);
const hasLoaded = ref<boolean>(false);

// --- 数据加载函数 ---
async function loadFromDB(): Promise<void> {
  if (hasLoaded.value) return; // 避免重复加载

  isLoading.value = true;
  isUpdatingFromDB = true; // 防止触发watch
  try {
    // 并行加载所有表数据
    const [packageRecords, orderRecords, goodsRecords, sellPriceRecords] = await Promise.all([
      db.packages.toArray(),
      db.sales.toArray(),
      db.goods.toArray(),
      db.sellPrices.toArray()
    ]);

    // 转换数据格式以匹配现有类型
    packages.value = packageRecords.map(record => ({
      id: record.id,
      batchId: record.batchId,
      tracking: record.tracking,
      content: record.content,
      quantity: record.quantity,
      costPrice: record.costPrice,
      note: record.note,
      verified: record.verified,
      timestamp: record.timestamp
    }));

    salesHistory.value = orderRecords;

    goodsList.value = goodsRecords.map(record => record.name);

    const sellPriceMap: Record<string, number> = {};
    sellPriceRecords.forEach(record => {
      sellPriceMap[record.goodsName] = record.price;
    });
    sellPrice.value = sellPriceMap;

    hasLoaded.value = true;
    console.log('数据加载完成');
  } catch (error) {
    console.error('数据加载失败:', error);
    throw error;
  } finally {
    isLoading.value = false;
    isUpdatingFromDB = false;
  }
}

// 生成唯一ID (与migration.ts中的一致)
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// --- 持久化 (替换localStorage为IndexedDB) ---
// 注意：这里使用watch监听变化并写入数据库，但需要考虑性能优化
// 对于频繁变化的数据，应该使用增量写入而不是全量覆盖

// 标志位，防止在加载数据时触发watch
let isUpdatingFromDB = false;

// 监听packages变化，同步到数据库（增量更新）
watch(packages, async (newPackages, oldPackages) => {
  if (isUpdatingFromDB) return;

  try {
    const oldIds = new Set((oldPackages || []).map(p => p.id).filter(Boolean) as string[]);
    const newIds = new Set(newPackages.map(p => p.id).filter(Boolean) as string[]);

    // 找出需要删除的id
    const idsToDelete = Array.from(oldIds).filter(id => !newIds.has(id));
    if (idsToDelete.length > 0) {
      await db.packages.bulkDelete(idsToDelete);
    }

    // 更新或插入所有新记录
    if (newPackages.length > 0) {
      const records = newPackages.map(pkg => ({
        id: pkg.id || generateId(),
        batchId: pkg.batchId,
        tracking: pkg.tracking,
        content: pkg.content,
        quantity: pkg.quantity,
        costPrice: pkg.costPrice,
        note: pkg.note,
        verified: pkg.verified,
        timestamp: pkg.timestamp
      }));
      await db.packages.bulkPut(records);
    }
  } catch (error) {
    console.error('同步packages到数据库失败:', error);
  }
}, { deep: true });

// 监听salesHistory变化，使用增量写入
watch(salesHistory, async (newSales) => {
  if (isUpdatingFromDB) return;

  try {
    // 使用bulkPut进行增量更新：根据id更新或插入
    // 注意：这种方法不会删除数据库中已删除的订单（销售订单通常不会被删除）
    if (newSales.length > 0) {
      await db.sales.bulkPut(newSales);
    }
  } catch (error) {
    console.error('同步sales到数据库失败:', error);
  }
}, { deep: true });

// 监听goodsList变化，同步到数据库
watch(goodsList, async (newGoods) => {
  if (isUpdatingFromDB) return;

  try {
    await db.goods.clear();
    if (newGoods.length > 0) {
      const records = newGoods.map(name => ({ name }));
      await db.goods.bulkAdd(records);
    }
  } catch (error) {
    console.error('同步goods到数据库失败:', error);
  }
}, { deep: true });

// 监听sellPrice变化，同步到数据库
watch(sellPrice, async (newPrices) => {
  if (isUpdatingFromDB) return;

  try {
    await db.sellPrices.clear();
    const entries = Object.entries(newPrices);
    if (entries.length > 0) {
      const records = entries.map(([goodsName, price]) => ({ goodsName, price }));
      await db.sellPrices.bulkAdd(records);
    }
  } catch (error) {
    console.error('同步sellPrices到数据库失败:', error);
  }
}, { deep: true });

// 在loadFromDB函数中设置标志，防止触发watch
// 修改loadFromDB函数，在更新数据前设置isUpdatingFromDB为true
// 注意：这里需要修改前面定义的loadFromDB函数

export function useStore() {
  const formatCurrency = (val: number | string): string => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Decimal(num).toNumber().toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isSameDay = (d1: Date | number, d2: Date | number): boolean => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // --- 库存核心算法 (WAC) ---
  const inventoryList = computed<InventoryItem[]>(() => {
    const map: Record<string, { name: string; quantity: number; totalCost: Decimal }> = {};
    
    // 1. 进货累加
    packages.value.forEach(p => {
      if (!p.verified) return;
      const name = (p.content || '').trim();
      if (!name) return;
      if (!map[name]) map[name] = { name, quantity: 0, totalCost: new Decimal(0) };
      
      const qty = new Decimal(p.quantity || 0);
      const cost = new Decimal(p.costPrice || 0);
      map[name].quantity = qty.add(map[name].quantity).toNumber();
      map[name].totalCost = map[name].totalCost.add(qty.times(cost));
    });

    // 2. 销售扣减 (排除已退款订单)
    salesHistory.value.forEach(sale => {
      if (sale.status === 'refunded') return;
      sale.items.forEach(sold => {
        const item = map[sold.name];
        if (item) {
          const currentAvgCost = item.quantity > 0
            ? item.totalCost.dividedBy(item.quantity)
            : new Decimal(sold.costSnapshot);

          item.quantity = new Decimal(item.quantity).minus(sold.quantity).toNumber();
          item.totalCost = item.totalCost.minus(new Decimal(sold.quantity).times(currentAvgCost));
        }
      });
    });

    return Object.values(map)
      .filter(i => i.quantity >= 0) // 允许显示0库存，方便补货
      .map(i => ({
        name: i.name,
        quantity: i.quantity,
        averageCost: i.quantity > 0 ? i.totalCost.dividedBy(i.quantity).toNumber() : 0
      }))
      .sort((a, b) => b.quantity - a.quantity);
  });

  // --- 统计数据 ---
  const totalInventoryValue = computed<number>(() => {
    return inventoryList.value.reduce((sum, i) => {
      return sum + (i.quantity * i.averageCost);
    }, 0);
  });
  
  const totalInventoryCount = computed<number>(() => {
    return inventoryList.value.reduce((sum, i) => sum + i.quantity, 0);
  });

  // 每日经营数据
  const dailyStats = computed<DailyStats>(() => {
    const targetDate = selectedDate.value;
    const validSales = salesHistory.value.filter(s => s.status !== 'refunded');
    const dayOrders = validSales.filter(s => isSameDay(s.timestamp, targetDate));
    
    const revenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const profit = dayOrders.reduce((sum, o) => sum + o.totalProfit, 0);
    const count = dayOrders.length;
    const aov = count > 0 ? (revenue / count) : 0;

    return {
      revenue,
      profit,
      count,
      aov,
      marginRate: revenue ? ((profit / revenue) * 100).toFixed(1) : '0.0',
      orders: dayOrders.sort((a,b) => b.timestamp - a.timestamp)
    };
  });

  // 真实图表数据 (过去7天)
  const chartData = computed<ChartData>(() => {
    const days: { label: string; active: boolean }[] = [];
    const profitData: number[] = [];
    const revenueData: number[] = [];
    const anchor = new Date(selectedDate.value);
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      const startStr = d.toLocaleDateString('zh-CN', { day: 'numeric' });
      
      const dailySales = salesHistory.value.filter(s => 
        s.status !== 'refunded' && isSameDay(s.timestamp, d)
      );
      const dayProfit = dailySales.reduce((acc, cur) => acc + cur.totalProfit, 0);
      const dayRevenue = dailySales.reduce((acc, cur) => acc + cur.totalAmount, 0);
      
      days.push({ label: startStr, active: isSameDay(d, selectedDate.value) });
      profitData.push(dayProfit);
      revenueData.push(dayRevenue);
    }
    
    const maxVal = Math.max(...revenueData, 10); // 最小刻度10，防止全0时无法渲染
    return { labels: days, values: profitData, revenueValues: revenueData, max: maxVal };
  });

  const topSelling = computed<{ name: string; qty: number }[]>(() => {
    const counter: Record<string, number> = {};
    salesHistory.value
      .filter(s => s.status !== 'refunded')
      .forEach(order => {
        order.items.forEach(item => {
          counter[item.name] = (counter[item.name] || 0) + item.quantity;
        });
      });
    return Object.entries(counter)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);
  });

  // 预警逻辑优化：返回对象，包含数量
  const lowStockItems = computed<InventoryItem[]>(
    () => inventoryList.value
      .filter(i => i.quantity < 10) // 阈值提高到10
      .sort((a, b) => a.quantity - b.quantity) // 越少越靠前
      .slice(0, 3)
  );

  // --- 订单操作 ---
  const refundOrder = (id: string): void => {
    const order = salesHistory.value.find(o => o.id === id);
    if (order) order.status = 'refunded';
  };

  const updateOrderNote = (id: string, note: string): void => {
    const order = salesHistory.value.find(o => o.id === id);
    if (order) order.note = note;
  };

  return {
    packages,
    goodsList,
    salesHistory,
    sellPrice,
    selectedDate,
    inventoryList,
    totalInventoryValue,
    totalInventoryCount,
    dailyStats,
    topSelling,
    lowStockItems,
    chartData,
    formatCurrency,
    refundOrder,
    updateOrderNote,
    isSameDay,
    // 新增的异步加载相关
    loadFromDB,
    isLoading,
    hasLoaded
  };
}