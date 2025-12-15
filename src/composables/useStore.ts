import { ref, computed, watch } from 'vue';
import Decimal from 'decimal.js';
import { Package, Order, InventoryItem, DailyStats, ChartData } from '../types/domain';

// --- 单例状态 ---
const packages = ref<Package[]>(JSON.parse(localStorage.getItem('tm_packages') || '[]'));
const goodsList = ref<Goods[]>(JSON.parse(localStorage.getItem('tm_goods_list') || '[]'));
const salesHistory = ref<Order[]>(JSON.parse(localStorage.getItem('tm_sales_history') || '[]'));
const sellPrice = ref<Record<string, number>>(JSON.parse(localStorage.getItem('tm_sell_prices') || '{}'));

// 全局选中的日期 (用于 Dashboard 时间旅行)
const selectedDate = ref<Date>(new Date());

// --- 持久化 ---
watch(packages, (v) => localStorage.setItem('tm_packages', JSON.stringify(v)), { deep: true });
watch(goodsList, (v) => localStorage.setItem('tm_goods_list', JSON.stringify(v)), { deep: true });
watch(salesHistory, (v) => localStorage.setItem('tm_sales_history', JSON.stringify(v)), { deep: true });
watch(sellPrice, (v) => localStorage.setItem('tm_sell_prices', JSON.stringify(v)), { deep: true });

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
        if (map[sold.name]) {
          const currentAvgCost = map[sold.name].quantity > 0 
            ? map[sold.name].totalCost.dividedBy(map[sold.name].quantity)
            : new Decimal(sold.costSnapshot);
          
          map[sold.name].quantity = new Decimal(map[sold.name].quantity).minus(sold.quantity).toNumber();
          map[sold.name].totalCost = map[sold.name].totalCost.minus(new Decimal(sold.quantity).times(currentAvgCost));
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
    isSameDay
  };
}