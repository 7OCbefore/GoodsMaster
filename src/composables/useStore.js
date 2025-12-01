import { ref, computed, watch } from 'vue';

// --- 状态定义 (State) ---
// 使用 localStorage 初始化数据，保证刷新不丢失
const packages = ref(JSON.parse(localStorage.getItem('tm_packages')) || []);
const goodsList = ref(JSON.parse(localStorage.getItem('tm_goods_list')) || []);
const salesHistory = ref(JSON.parse(localStorage.getItem('tm_sales_history')) || []);
const sellPrice = ref(JSON.parse(localStorage.getItem('tm_sell_prices')) || {});

// --- 持久化监听 (Persistence) ---
watch(packages, (v) => localStorage.setItem('tm_packages', JSON.stringify(v)), { deep: true });
watch(goodsList, (v) => localStorage.setItem('tm_goods_list', JSON.stringify(v)), { deep: true });
watch(salesHistory, (v) => localStorage.setItem('tm_sales_history', JSON.stringify(v)), { deep: true });
watch(sellPrice, (v) => localStorage.setItem('tm_sell_prices', JSON.stringify(v)), { deep: true });

// --- 导出逻辑 (Composable) ---
export function useStore() {
    
    // 1. 辅助函数
    const formatCurrency = (v) => Number(v).toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2});

    // 2. 库存核心算法 (Inventory Logic)
    // 库存 = 进货(已核验) - 销售(已出库)
    const inventoryList = computed(() => {
        const map = {};
        
        // Step A: 累加进货
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

        // Step B: 扣减销售
        salesHistory.value.forEach(sale => {
            sale.items.forEach(sold => {
                if (map[sold.name]) {
                    map[sold.name].quantity -= sold.quantity;
                    // 简化成本扣减：按比例扣除总成本，保持剩余库存均价不变
                    // (严谨会计做法可能不同，但此处满足小生意需求)
                    const costPerUnit = map[sold.name].quantity > 0 
                        ? (map[sold.name].totalCost / (map[sold.name].quantity + sold.quantity)) 
                        : sold.costSnapshot;
                    map[sold.name].totalCost -= (costPerUnit * sold.quantity);
                }
            });
        });

        // Step C: 格式化输出
        return Object.values(map)
            .filter(i => i.quantity > 0) // 只显示有货的
            .map(i => ({
                name: i.name,
                quantity: i.quantity,
                averageCost: i.quantity > 0 ? (i.totalCost / i.quantity) : 0
            }))
            .sort((a, b) => b.quantity - a.quantity);
    });

    // 3. 统计数据 (Stats)
    const totalInventoryValue = computed(() => inventoryList.value.reduce((s, i) => s + (i.averageCost * i.quantity), 0));
    const totalInventoryCount = computed(() => inventoryList.value.reduce((s, i) => s + i.quantity, 0));

    const salesStats = computed(() => {
        const today = new Date().setHours(0,0,0,0);
        const todayOrders = salesHistory.value.filter(s => s.timestamp >= today);
        const revenue = todayOrders.reduce((s,o) => s + o.totalAmount, 0);
        const profit = todayOrders.reduce((s,o) => s + o.totalProfit, 0);
        return {
            todayRevenue: revenue,
            todayProfit: profit,
            marginRate: revenue ? ((profit/revenue)*100).toFixed(1) : '0.0'
        };
    });

    const topSelling = computed(() => {
        const map = {};
        salesHistory.value.forEach(s => s.items.forEach(i => map[i.name] = (map[i.name]||0)+i.quantity));
        return Object.entries(map)
            .map(([name, qty]) => ({name, qty}))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 3);
    });

    const lowStockItems = computed(() => inventoryList.value.filter(i => i.quantity < 5).map(i => i.name));

    return {
        // State
        packages, goodsList, salesHistory, sellPrice,
        // Computed
        inventoryList, totalInventoryValue, totalInventoryCount,
        salesStats, topSelling, lowStockItems,
        // Helpers
        formatCurrency
    };
}