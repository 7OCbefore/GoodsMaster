import { ref, computed, watch, onMounted } from 'vue';
import { useStore as useOriginalStore } from './useStore';
import { 
  getPackages, 
  addPackage, 
  verifyPackage, 
  deletePackage,
  getGoodsList,
  addGood,
  getSalesHistory,
  addSale,
  refundOrder,
  getSellPrices,
  setSellPrice
} from '../services/dataService';

export function useStore() {
  // Use original store for UI state and helpers
  const originalStore = useOriginalStore();
  
  // Supabase data state
  const packages = ref([]);
  const goodsList = ref([]);
  const salesHistory = ref([]);
  const sellPrice = ref({});
  const selectedDate = ref(new Date());
  const user = ref(null);
  const loading = ref(false);
  const error = ref(null);
  
  // Default user ID for non-authenticated system
  const DEFAULT_USER_ID = 'default-user-id';
  
  // Helper function to get user ID (always returns default user ID)
  const getUserId = () => DEFAULT_USER_ID;
  
  // Load data from Supabase
  const loadData = async (userId = DEFAULT_USER_ID) => {
    loading.value = true;
    error.value = null;
    
    try {
      // Load all data in parallel
      const [packagesData, goodsData, salesData, pricesData] = await Promise.allSettled([
        getPackages(userId),
        getGoodsList(userId),
        getSalesHistory(userId),
        getSellPrices(userId)
      ]);
      
      // 处理每个请求的结果
      if (packagesData.status === 'fulfilled' && !packagesData.value.error) {
        packages.value = packagesData.value.data || [];
      } else {
        console.warn('Failed to load packages:', packagesData.status === 'rejected' ? packagesData.reason : packagesData.value.error);
        packages.value = []; // 使用空数组作为后备
      }
      
      if (goodsData.status === 'fulfilled' && !goodsData.value.error) {
        goodsList.value = goodsData.value.data || [];
      } else {
        console.warn('Failed to load goods:', goodsData.status === 'rejected' ? goodsData.reason : goodsData.value.error);
        goodsList.value = []; // 使用空数组作为后备
      }
      
      if (salesData.status === 'fulfilled' && !salesData.value.error) {
        salesHistory.value = salesData.value.data || [];
      } else {
        console.warn('Failed to load sales:', salesData.status === 'rejected' ? salesData.reason : salesData.value.error);
        salesHistory.value = []; // 使用空数组作为后备
      }
      
      if (pricesData.status === 'fulfilled' && !pricesData.value.error) {
        // Convert prices array to object for easier lookup
        sellPrice.value = (pricesData.value.data || []).reduce((acc, price) => {
          acc[price.goods_name] = price.price;
          return acc;
        }, {});
      } else {
        console.warn('Failed to load prices:', pricesData.status === 'rejected' ? pricesData.reason : pricesData.value.error);
        sellPrice.value = {}; // 使用空对象作为后备
      }
      
    } catch (err) {
      error.value = err.message;
      console.error('Error during data loading:', err);
      // 设置默认值以确保应用可以继续运行
      packages.value = [];
      goodsList.value = [];
      salesHistory.value = [];
      sellPrice.value = {};
    } finally {
      loading.value = false;
    }
  };
  
  // --- Inventory Core Algorithm (WAC) ---
  const inventoryList = computed(() => {
    const map = {};
    // 1. 进货累加
    packages.value.forEach(p => {
      if (!p.verified) return;
      const name = (p.content || '').trim();
      if (!name) return;
      if (!map[name]) map[name] = { name, quantity: 0, totalCost: 0 };
      
      const qty = Number(p.quantity) || 0;
      const cost = Number(p.costPrice) || 0;
      map[name].quantity += qty;
      map[name].totalCost += (qty * cost);
    });

    // 2. 销售扣减 (排除已退款订单)
    salesHistory.value.forEach(sale => {
      if (sale.status === 'refunded') return;
      sale.items.forEach(sold => {
        if (map[sold.name]) {
          const currentAvgCost = map[sold.name].quantity > 0 
              ? (map[sold.name].totalCost / map[sold.name].quantity) 
              : sold.costSnapshot;
          
          map[sold.name].quantity -= sold.quantity;
          map[sold.name].totalCost -= (sold.quantity * currentAvgCost);
        }
      });
    });

    return Object.values(map)
        .filter(i => i.quantity >= 0) // 允许显示0库存，方便补货
        .map(i => ({
          name: i.name,
          quantity: i.quantity,
          averageCost: i.quantity > 0 ? (i.totalCost / i.quantity) : 0
        }))
        .sort((a, b) => b.quantity - a.quantity);
  });
  
  // --- Statistics ---
  const totalInventoryValue = computed(() => inventoryList.value.reduce((sum, i) => sum + (i.quantity * i.averageCost), 0));
  const totalInventoryCount = computed(() => inventoryList.value.reduce((sum, i) => sum + i.quantity, 0));
  
  const isSameDay = (d1, d2) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };
  
  // Daily stats
  const dailyStats = computed(() => {
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
  
  // Chart data (past 7 days)
  const chartData = computed(() => {
    const days = [];
    const profitData = [];
    const revenueData = [];
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
  
  const topSelling = computed(() => {
    const counter = {};
    salesHistory.value.filter(s => s.status !== 'refunded').forEach(order => {
      order.items.forEach(item => {
        counter[item.name] = (counter[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(counter).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 3);
  });
  
  // Low stock items
  const lowStockItems = computed(() => 
      inventoryList.value
          .filter(i => i.quantity < 10) // 阈值提高到10
          .sort((a,b) => a.quantity - b.quantity) // 越少越靠前
          .slice(0, 3)
  );
  
  // --- Data Operations ---
  const addNewPackage = async (packageData) => {
    const userId = getUserId();
    
    try {
      const packageWithUser = { ...packageData, user_id: userId };
      const { data, error } = await addPackage(packageWithUser);
      
      if (error) throw error;
      
      // Update local state
      packages.value.push(data[0]);
      originalStore.showToast('进货成功!', 'success');
      return { data: data[0], error: null };
    } catch (err) {
      originalStore.showToast('进货失败: ' + err.message, 'error');
      return { data: null, error: err };
    }
  };
  
  const verifyExistingPackage = async (packageId) => {
    const userId = getUserId();
    
    try {
      const { data, error } = await verifyPackage(packageId, userId);
      
      if (error) throw error;
      
      // Update local state
      const index = packages.value.findIndex(p => p.id === packageId);
      if (index !== -1) {
        packages.value[index] = data[0];
      }
      
      originalStore.showToast('验证成功!', 'success');
      return { data: data[0], error: null };
    } catch (err) {
      originalStore.showToast('验证失败: ' + err.message, 'error');
      return { data: null, error: err };
    }
  };
  
  const deleteExistingPackage = async (packageId) => {
    const userId = getUserId();
    
    try {
      const { error } = await deletePackage(packageId, userId);
      
      if (error) throw error;
      
      // Update local state
      const index = packages.value.findIndex(p => p.id === packageId);
      if (index !== -1) {
        packages.value.splice(index, 1);
      }
      
      originalStore.showToast('删除成功!', 'success');
      return { error: null };
    } catch (err) {
      originalStore.showToast('删除失败: ' + err.message, 'error');
      return { error: err };
    }
  };
  
  const recordSale = async (saleData) => {
    const userId = getUserId();
    
    try {
      const saleWithUser = { ...saleData, user_id: userId };
      const { data, error } = await addSale(saleWithUser);
      
      if (error) throw error;
      
      // Update local state
      salesHistory.value.push(data[0]);
      originalStore.showToast('销售记录成功!', 'success');
      return { data: data[0], error: null };
    } catch (err) {
      originalStore.showToast('销售记录失败: ' + err.message, 'error');
      return { data: null, error: err };
    }
  };
  
  const refundExistingOrder = async (orderId) => {
    const userId = getUserId();
    
    try {
      const { data, error } = await refundOrder(orderId, userId);
      
      if (error) throw error;
      
      // Update local state
      const index = salesHistory.value.findIndex(s => s.id === orderId);
      if (index !== -1) {
        salesHistory.value[index] = data[0];
      }
      
      originalStore.showToast('退款成功!', 'success');
      return { data: data[0], error: null };
    } catch (err) {
      originalStore.showToast('退款失败: ' + err.message, 'error');
      return { data: null, error: err };
    }
  };
  
  const setSellPriceForGood = async (goodsName, price) => {
    const userId = getUserId();
    
    try {
      const priceData = { 
        user_id: userId, 
        goods_name: goodsName, 
        price: parseFloat(price) 
      };
      
      const { data, error } = await setSellPrice(priceData);
      
      if (error) throw error;
      
      // Update local state
      sellPrice.value[goodsName] = parseFloat(price);
      
      originalStore.showToast('售价设置成功!', 'success');
      return { data: data[0], error: null };
    } catch (err) {
      originalStore.showToast('售价设置失败: ' + err.message, 'error');
      return { data: null, error: err };
    }
  };
  
  return {
    // Original store properties
    ...originalStore,
    // New Supabase properties
    packages, 
    goodsList, 
    salesHistory, 
    sellPrice, 
    selectedDate,
    user,
    loading,
    error,
    // Computed properties
    inventoryList, 
    totalInventoryValue, 
    totalInventoryCount,
    dailyStats, 
    topSelling, 
    lowStockItems, 
    chartData,
    // Methods
    loadData,
    addNewPackage,
    verifyExistingPackage,
    deleteExistingPackage,
    recordSale,
    refundExistingOrder,
    setSellPriceForGood,
    isSameDay
  };
}