<script setup>
import { ref, computed, inject } from 'vue';
import { useStore } from '../composables/useStore';

const { selectedDate, dailyStats, chartData, lowStockItems, topSelling, formatCurrency, refundOrder, updateOrderNote } = useStore();
const showToast = inject('showToast');
const showDialog = inject('showDialog');

// --- 日期处理 ---
// 使用 getter/setter 确保与 input type="date" 的字符串格式双向绑定
const dateInputVal = computed({
  get: () => {
    // 处理时区偏移，确保显示的是本地日期的 YYYY-MM-DD
    const d = new Date(selectedDate.value);
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d - offset)).toISOString().slice(0, 10);
    return localISOTime;
  },
  set: (val) => {
    // 重新设为当天的 00:00:00
    const d = new Date(val);
    d.setHours(0,0,0,0);
    selectedDate.value = d;
  }
});

const isToday = computed(() => {
  const today = new Date();
  const sel = new Date(selectedDate.value);
  return today.toDateString() === sel.toDateString();
});

const setToday = () => selectedDate.value = new Date();

const displayDate = computed(() => {
  return new Date(selectedDate.value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
});

// --- 订单详情抽屉 ---
const isDetailOpen = ref(false);
const currentOrder = ref(null);

const openOrderDetail = (order) => {
  currentOrder.value = order;
  isDetailOpen.value = true;
};

const handleRefund = () => {
  if (!currentOrder.value) return;
  showDialog({
    title: '确认退单',
    content: '退单后库存将自动恢复，且该笔金额从统计中扣除。',
    isDanger: true,
    confirmText: '确认退款',
    action: () => {
      refundOrder(currentOrder.value.id);
      showToast('已退单');
      isDetailOpen.value = false;
    }
  });
};

const handleEditNote = () => {
  if (!currentOrder.value) return;
  showDialog({
    title: '修改备注',
    isInput: true,
    inputValue: currentOrder.value.note || '',
    confirmText: '保存',
    action: (val) => {
      updateOrderNote(currentOrder.value.id, val);
      showToast('备注已更新');
    }
  });
};
</script>

<template>
  <div class="flex flex-col h-full bg-[#F5F5F7]">
    
    <!-- 1. 顶部导航 (日期控制) - 修复对齐 -->
    <header class="px-5 py-3 pt-safe bg-surface sticky top-0 z-30 flex items-center justify-between shadow-sm border-b border-gray-100">
        <h1 class="text-2xl font-extrabold text-primary tracking-tight">经营总览</h1>
        
        <div class="flex items-center gap-2">
            <!-- 日期选择器按钮 -->
            <div class="relative bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 active:bg-gray-50 transition-colors overflow-hidden">
                <i class="ph-bold ph-calendar-blank text-accent"></i>
                <span class="text-sm font-bold text-primary">{{ displayDate }}</span>
                <!-- 透明 Input 覆盖，确保 w-full h-full 点击区域 -->
                <input 
                    type="date" 
                    v-model="dateInputVal" 
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                >
            </div>

            <!-- 回到今天 -->
            <button 
                v-if="!isToday"
                @click="setToday"
                class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            >
                <i class="ph-bold ph-clock-counter-clockwise"></i>
            </button>
        </div>
    </header>

    <div class="flex-1 overflow-y-auto p-5 pb-32 space-y-5 hide-scrollbar">
      
      <!-- 2. 核心财务卡片 -->
      <div class="bg-primary rounded-[28px] p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
        <div class="absolute right-0 top-0 w-48 h-48 bg-accent/20 rounded-full blur-[60px] group-hover:bg-accent/30 transition-all duration-700"></div>
        <div class="relative z-10">
          <div class="flex justify-between items-start mb-2">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">净利润 (Profit)</span>
          </div>
          <div class="text-[46px] font-bold tracking-tight mb-6 leading-none font-mono">
            <span class="text-2xl text-gray-500 font-sans mr-1">¥</span>{{ formatCurrency(dailyStats.profit) }}
          </div>
          <div class="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
            <div>
              <div class="text-[10px] text-gray-500 mb-0.5">营收</div>
              <div class="text-base font-bold">¥{{ formatCurrency(dailyStats.revenue) }}</div>
            </div>
            <div class="border-l border-white/10 pl-3">
              <div class="text-[10px] text-gray-500 mb-0.5">订单</div>
              <div class="text-base font-bold">{{ dailyStats.count }}</div>
            </div>
            <div class="border-l border-white/10 pl-3">
              <div class="text-[10px] text-gray-500 mb-0.5">利润率</div>
              <div class="text-base font-bold text-success">{{ dailyStats.marginRate }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 趋势图表 (真实渲染) -->
      <div class="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
        <div class="flex justify-between mb-6 items-center">
          <h3 class="font-bold text-primary text-sm flex items-center gap-1">
            <i class="ph-bold ph-chart-bar text-accent"></i> 利润趋势
          </h3>
          <span class="text-[10px] text-gray-400">近7天</span>
        </div>
        <div class="h-28 flex items-end justify-between gap-3">
          <div v-for="(point, i) in chartData.labels" :key="i" class="flex-1 flex flex-col items-center gap-2 group cursor-default">
            <!-- 柱状条 -->
            <div class="w-full bg-gray-50 rounded-t-md relative overflow-hidden h-full flex items-end">
               <div 
                  class="w-full rounded-t-md transition-all duration-500 min-h-[4px]"
                  :class="point.active ? 'bg-primary' : 'bg-accent/60 group-hover:bg-accent'"
                  :style="{height: (chartData.values[i] / chartData.max) * 100 + '%'}"
               ></div>
            </div>
            <!-- 日期标签 -->
            <span class="text-[10px] font-bold" :class="point.active ? 'text-primary scale-110' : 'text-gray-300'">{{ point.label }}</span>
          </div>
        </div>
      </div>

      <!-- 4. 次级指标网格 -->
      <div class="grid grid-cols-2 gap-4">
        <!-- 客单价 -->
        <div class="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100">
          <div class="text-[10px] text-gray-400 font-bold uppercase mb-1">平均客单价</div>
          <div class="text-2xl font-bold text-primary">¥{{ formatCurrency(dailyStats.aov) }}</div>
        </div>
        <!-- 缺货预警 (带交互) -->
        <div class="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100 relative overflow-hidden">
          <div class="text-[10px] text-gray-400 font-bold uppercase mb-2 flex justify-between">
            <span>库存预警</span>
            <span class="text-danger font-bold">{{ lowStockItems.length }}</span>
          </div>
          <div class="space-y-2">
            <div v-if="!lowStockItems.length" class="text-xs text-gray-300 py-1">库存健康</div>
            <!-- 显示真实预警商品 -->
            <div v-for="item in lowStockItems" :key="item.name" class="flex justify-between items-center text-xs">
              <span class="font-bold text-primary truncate max-w-[60%]">{{ item.name }}</span>
              <span class="bg-danger/10 text-danger px-1.5 py-0.5 rounded font-bold">剩{{ item.quantity }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. 当日订单流 -->
      <div>
        <h3 class="font-bold text-primary text-sm mb-3 px-1 flex items-center justify-between">
          <span>当日订单</span>
          <span class="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px]">{{ dailyStats.count }}</span>
        </h3>
        <div class="space-y-3">
          <div v-if="dailyStats.orders.length === 0" class="text-center py-10 text-gray-400 text-xs">
            <i class="ph-duotone ph-receipt text-3xl mb-2 opacity-50"></i>
            <p>该日期暂无销售记录</p>
          </div>
          <div 
            v-for="order in dailyStats.orders" 
            :key="order.id" 
            @click="openOrderDetail(order)"
            class="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex justify-between items-center active:scale-[0.98] transition-transform"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-primary font-bold shadow-inner">
                <i class="ph-bold ph-bag"></i>
              </div>
              <div>
                <div class="font-bold text-sm text-primary">¥{{ formatCurrency(order.totalAmount) }}</div>
                <div class="text-[10px] text-gray-400 font-medium">
                  {{ new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }} · {{ order.customer || '散客' }}
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs font-bold text-success">+¥{{ formatCurrency(order.totalProfit) }}</div>
              <div class="text-[10px] text-gray-300">{{ order.items.length }} 件商品</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 6. 订单详情抽屉 -->
    <Transition name="fade">
      <div v-if="isDetailOpen" class="fixed inset-0 z-[100] flex flex-col justify-end">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="isDetailOpen=false"></div>
        <div class="bg-surface w-full h-[85vh] rounded-t-[32px] relative z-10 flex flex-col shadow-2xl animate-fade-in overflow-hidden">
          
          <div class="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
            <h2 class="text-lg font-bold text-primary">订单详情</h2>
            <button @click="isDetailOpen=false" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:bg-gray-200">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <div v-if="currentOrder" class="flex-1 overflow-y-auto p-5 bg-gray-50">
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden receipt-pattern">
              <div v-if="currentOrder.status === 'refunded'" class="absolute right-4 top-4 border-2 border-gray-300 text-gray-300 font-bold px-2 py-1 rounded rotate-12 text-sm">已退款</div>

              <div class="flex justify-between items-start mb-6">
                <div>
                  <div class="text-xs text-gray-400 mb-1">客户信息</div>
                  <div class="font-bold text-primary text-lg">{{ currentOrder.customer || '散客' }}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs text-gray-400 mb-1">时间</div>
                  <div class="font-mono text-sm font-bold text-gray-600">{{ new Date(currentOrder.timestamp).toLocaleString() }}</div>
                </div>
              </div>

              <div class="space-y-3 mb-6 border-t border-dashed border-gray-200 pt-4">
                <div v-for="item in currentOrder.items" :key="item.name" class="flex justify-between items-center text-sm">
                  <div>
                    <div class="font-bold text-primary">{{ item.name }}</div>
                    <div class="text-[10px] text-gray-400 mt-0.5">
                      成本 ¥{{ formatCurrency(item.costSnapshot) }} × {{ item.quantity }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold">¥{{ formatCurrency(item.sellPrice * item.quantity) }}</div>
                    <div class="text-[10px] text-success font-medium">赚 ¥{{ formatCurrency((item.sellPrice - item.costSnapshot) * item.quantity) }}</div>
                  </div>
                </div>
              </div>

              <div class="border-t border-gray-100 pt-4 space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">总计金额</span>
                  <span class="font-bold text-primary">¥{{ formatCurrency(currentOrder.totalAmount) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">总毛利</span>
                  <span class="font-bold text-success">+¥{{ formatCurrency(currentOrder.totalProfit) }}</span>
                </div>
              </div>

              <div v-if="currentOrder.note" class="mt-4 bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-xs text-yellow-700">
                <span class="font-bold">备注：</span> {{ currentOrder.note }}
              </div>
            </div>
          </div>

          <div v-if="currentOrder && currentOrder.status !== 'refunded'" class="bg-white p-4 border-t border-gray-100 pb-safe grid grid-cols-2 gap-3 shrink-0">
            <button @click="handleEditNote" class="py-3.5 rounded-xl font-bold text-primary bg-gray-100 active:bg-gray-200 transition-colors">
              {{ currentOrder.note ? '修改备注' : '添加备注' }}
            </button>
            <button @click="handleRefund" class="py-3.5 rounded-xl font-bold text-danger bg-danger/10 active:bg-danger/20 transition-colors">
              退单
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.receipt-pattern {
  background-image: radial-gradient(#f3f4f6 1px, transparent 1px);
  background-size: 10px 10px;
}
</style>