import { ref, computed, watch } from 'vue';

// --- 单例状态 ---
const packages = ref(JSON.parse(localStorage.getItem('tm_packages')) || []);
const goodsList = ref(JSON.parse(localStorage.getItem('tm_goods_list')) || []);
const salesHistory = ref(JSON.parse(localStorage.getItem('tm_sales_history')) || []);
const sellPrice = ref(JSON.parse(localStorage.getItem('tm_sell_prices')) || {});

// 全局选中的日期 (用于 Dashboard 时间旅行)
const selectedDate = ref(new Date());

// --- 持久化 ---
watch(packages, (v) => localStorage.setItem('tm_packages', JSON.stringify(v)), { deep: true });
watch(goodsList, (v) => localStorage.setItem('tm_goods_list', JSON.stringify(v)), { deep: true });
watch(salesHistory, (v) => localStorage.setItem('tm_sales_history', JSON.stringify(v)), { deep: true });
watch(sellPrice, (v) => localStorage.setItem('tm_sell_prices', JSON.stringify(v)), { deep: true });

export function useStore() {
    const formatCurrency = (val) => Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const isSameDay = (d1, d2) => {
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    };

    // --- 库存核心算法 (WAC) ---
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

    // --- 统计数据 ---
    const totalInventoryValue = computed(() => inventoryList.value.reduce((sum, i) => sum + (i.quantity * i.averageCost), 0));
    const totalInventoryCount = computed(() => inventoryList.value.reduce((sum, i) => sum + i.quantity, 0));

    // 每日经营数据
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

    // 真实图表数据 (过去7天)
    const chartData = computed(() => {
        const days = [];
        const data = [];
        const anchor = new Date(selectedDate.value);
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(anchor);
            d.setDate(d.getDate() - i);
            const startStr = d.toLocaleDateString('zh-CN', { day: 'numeric' });
            
            const dailySales = salesHistory.value.filter(s => 
                s.status !== 'refunded' && isSameDay(s.timestamp, d)
            );
            const dayProfit = dailySales.reduce((acc, cur) => acc + cur.totalProfit, 0);
            
            days.push({ label: startStr, active: isSameDay(d, selectedDate.value) });
            data.push(dayProfit);
        }
        
        const maxVal = Math.max(...data, 10); // 最小刻度10，防止全0时无法渲染
        return { labels: days, values: data, max: maxVal };
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

    // 预警逻辑优化：返回对象，包含数量
    const lowStockItems = computed(() => 
        inventoryList.value
            .filter(i => i.quantity < 10) // 阈值提高到10
            .sort((a,b) => a.quantity - b.quantity) // 越少越靠前
            .slice(0, 3)
    );

    // --- 订单操作 ---
    const refundOrder = (id) => {
        const order = salesHistory.value.find(o => o.id === id);
        if (order) order.status = 'refunded';
    };

    const updateOrderNote = (id, note) => {
        const order = salesHistory.value.find(o => o.id === id);
        if (order) order.note = note;
    };

    return {
        packages, goodsList, salesHistory, sellPrice, selectedDate,
        inventoryList, totalInventoryValue, totalInventoryCount,
        dailyStats, topSelling, lowStockItems, chartData,
        formatCurrency, refundOrder, updateOrderNote
    };
}