<script setup>
import { ref, computed, inject, onMounted } from 'vue';
import { useStore } from '../composables/useSupabaseStore';
import { useExport } from '../composables/useExport';

const store = useStore();
const { 
  selectedDate, 
  dailyStats, 
  chartData, 
  lowStockItems, 
  topSelling, 
  formatCurrency, 
  refundOrder, 
  updateOrderNote, 
  salesHistory, 
  inventoryList,
  user,
  loadData
} = store;
const showToast = inject('showToast');
const showDialog = inject('showDialog');
const { exportToExcel } = useExport();

// --- 日期处理 ---
const showDatePicker = ref(false);
const currentMonth = ref(new Date());
const selectedBarIndex = ref(null); // 选中的柱状图索引

const isToday = computed(() => {
  const today = new Date();
  const sel = new Date(selectedDate.value);
  return today.toDateString() === sel.toDateString();
});

const setToday = () => {
  selectedDate.value = new Date();
  selectedDate.value.setHours(0,0,0,0);
  currentMonth.value = new Date();
  showDatePicker.value = false;
};

const displayDate = computed(() => {
  return new Date(selectedDate.value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
});

const displayWeekday = computed(() => {
  return new Date(selectedDate.value).toLocaleDateString('zh-CN', { weekday: 'long' });
});

// 趋势图表数据处理
const trendStats = computed(() => {
  const totalProfit = chartData.value.values.reduce((sum, val) => sum + val, 0);
  const avgProfit = totalProfit / chartData.value.values.length;
  const maxProfit = Math.max(...chartData.value.values);
  const minProfit = Math.min(...chartData.value.values);
  
  // 计算趋势（与前一天比较）
  const today = chartData.value.values[chartData.value.values.length - 1];
  const yesterday = chartData.value.values[chartData.value.values.length - 2];
  const trend = today > yesterday ? 'up' : today < yesterday ? 'down' : 'stable';
  const trendPercent = yesterday > 0 ? (((today - yesterday) / yesterday) * 100).toFixed(1) : 0;
  
  return {
    total: totalProfit,
    avg: avgProfit,
    max: maxProfit,
    min: minProfit,
    trend,
    trendPercent
  };
});

// 获取柱子对应的完整日期
const getBarDateLabel = (index) => {
  if (index === null || index === undefined) return '';
  const anchor = new Date(selectedDate.value);
  const targetDate = new Date(anchor);
  targetDate.setDate(targetDate.getDate() - (6 - index));
  return targetDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
};

// 移动端点击切换柱子选中状态
const toggleBar = (index) => {
  selectedBarIndex.value = selectedBarIndex.value === index ? null : index;
};

// 切换日期选择器显示
const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value;
  if (showDatePicker.value) {
    currentMonth.value = new Date(selectedDate.value);
  }
};

// 生成日历数据
const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);
  
  const firstDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const daysInPrevMonth = prevLastDay.getDate();
  
  const days = [];
  
  // 上个月的日期
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: daysInPrevMonth - i,
      isCurrentMonth: false,
      fullDate: new Date(year, month - 1, daysInPrevMonth - i)
    });
  }
  
  // 当前月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: i,
      isCurrentMonth: true,
      fullDate: new Date(year, month, i)
    });
  }
  
  // 下个月的日期（补齐到6行）
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: i,
      isCurrentMonth: false,
      fullDate: new Date(year, month + 1, i)
    });
  }
  
  return days;
});

const currentMonthYear = computed(() => {
  return currentMonth.value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
});

const prevMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1);
};

const nextMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1);
};

const selectDate = (day) => {
  if (!day.isCurrentMonth) {
    currentMonth.value = new Date(day.fullDate);
  }
  selectedDate.value = new Date(day.fullDate);
  selectedDate.value.setHours(0,0,0,0);
  showDatePicker.value = false;
};

const isSelectedDate = (day) => {
  const sel = new Date(selectedDate.value);
  return day.fullDate.toDateString() === sel.toDateString();
};

const isTodayDate = (day) => {
  const today = new Date();
  return day.fullDate.toDateString() === today.toDateString();
};

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
    action: async () => {
      const result = await refundOrder(currentOrder.value.id);
      if (result.error) {
        showToast('退单失败: ' + result.error.message, 'error');
      } else {
        showToast('已退单');
        isDetailOpen.value = false;
      }
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

// --- Excel 导出 ---
const isExporting = ref(false);

const handleExport = async () => {
  isExporting.value = true;
  
  // 模拟异步操作，给用户视觉反馈
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const result = exportToExcel({
    salesHistory: salesHistory.value,
    inventoryList: inventoryList.value,
    selectedDate: selectedDate.value
  });
  
  isExporting.value = false;
  
  if (result.success) {
    showToast(`✅ 导出成功：${result.fileName}`);
  } else {
    showToast(`❌ 导出失败：${result.error}`);
  }
};
</script>

<template>
  <div class="flex flex-col h-full bg-[#F5F5F7]">
    
    <!-- 1. 顶部导航 (日期控制) -->
    <header class="px-5 pt-safe bg-surface sticky top-0 z-30 shadow-sm border-b border-gray-100">
        <div class="py-4 flex items-center justify-between w-full">
            <h1 class="text-2xl font-extrabold text-primary tracking-tight leading-none">经营总览</h1>
            
            <div class="flex items-center gap-2 relative">
                <!-- Excel 导出按钮 -->
                <button 
                    @click="handleExport"
                    :disabled="isExporting"
                    class="bg-white p-2 rounded-full border border-gray-200 shadow-sm flex items-center justify-center cursor-pointer active:bg-gray-50 transition-all hover:border-green-500 hover:bg-green-50 min-h-[36px] min-w-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="导出数据到Excel"
                >
                    <i v-if="!isExporting" class="ph-bold ph-microsoft-excel-logo text-green-600 text-lg"></i>
                    <i v-else class="ph-bold ph-spinner text-green-600 text-lg animate-spin"></i>
                </button>

                <!-- 日期选择器按钮 -->
                <button 
                    @click="toggleDatePicker"
                    class="bg-white px-3 py-2 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer active:bg-gray-50 transition-colors hover:border-primary min-h-[36px]"
                >
                    <i class="ph-bold ph-calendar-blank text-accent"></i>
                    <span class="text-sm font-bold text-primary whitespace-nowrap select-none">{{ displayDate }}</span>
                </button>

                <!-- 回到今天 -->
                <button
                    v-if="!isToday"
                    @click="setToday"
                    class="w-8 h-8 rounded-full bg-[#0A84FF] text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform flex-shrink-0"
                    title="回到今天"
                >
                    <span class="text-sm font-bold">今</span>
                </button>
                
                <!-- 自定义日历选择器 -->
                <Transition name="fade">
                    <div v-if="showDatePicker" class="absolute top-12 right-0 z-50">
                        <!-- 遮罩层 -->
                        <div @click="showDatePicker = false" class="fixed inset-0 -z-10"></div>
                        
                        <!-- 日历容器 -->
                        <div class="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-80 animate-pop">
                            <!-- 日期预览 -->
                            <div class="bg-gradient-to-r from-primary to-accent text-white rounded-xl p-3 mb-3">
                                <div class="text-xs opacity-80 mb-1">已选日期</div>
                                <div class="flex items-baseline gap-2">
                                    <span class="text-2xl font-bold">{{ new Date(selectedDate).getDate() }}</span>
                                    <span class="text-sm">{{ new Date(selectedDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }) }}</span>
                                </div>
                                <div class="text-xs mt-1 opacity-90">{{ displayWeekday }}</div>
                            </div>
                            
                            <!-- 月份导航 -->
                            <div class="flex items-center justify-between mb-3">
                                <button @click="prevMonth" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                                    <i class="ph-bold ph-caret-left text-primary"></i>
                                </button>
                                <span class="text-sm font-bold text-primary">{{ currentMonthYear }}</span>
                                <button @click="nextMonth" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                                    <i class="ph-bold ph-caret-right text-primary"></i>
                                </button>
                            </div>
                            
                            <!-- 星期标题 -->
                            <div class="grid grid-cols-7 gap-1 mb-2">
                                <div v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="text-center text-xs font-bold text-gray-400 py-1">
                                    {{ day }}
                                </div>
                            </div>
                            
                            <!-- 日期网格 -->
                            <div class="grid grid-cols-7 gap-1">
                                <button
                                    v-for="(day, index) in calendarDays"
                                    :key="index"
                                    @click="selectDate(day)"
                                    class="aspect-square rounded-lg text-sm flex items-center justify-center transition-all relative"
                                    :class="[
                                        day.isCurrentMonth ? 'text-primary hover:bg-gray-50' : 'text-gray-300',
                                        isSelectedDate(day) ? 'bg-primary text-white hover:bg-primary font-bold shadow-md scale-105' : '',
                                        isTodayDate(day) && !isSelectedDate(day) ? 'border-2 border-accent font-bold' : ''
                                    ]"
                                >
                                    {{ day.date }}
                                    <span v-if="isTodayDate(day) && !isSelectedDate(day)" class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full"></span>
                                </button>
                            </div>
                            
                            <!-- 快捷操作 -->
                            <div class="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                                <button 
                                    @click="setToday" 
                                    class="flex-1 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs font-bold text-primary transition-colors"
                                >
                                    回到今天
                                </button>
                                <button 
                                    @click="showDatePicker = false" 
                                    class="flex-1 py-2 rounded-lg bg-[#0A84FF] text-white text-xs font-bold hover:bg-opacity-90 transition-colors"
                                >
                                    确定
                                </button>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    </header>

    <div class="flex-1 overflow-y-auto p-5 pb-32 space-y-5 hide-scrollbar">
      
      <!-- 2. 核心财务卡片 -->
      <div class="bg-gradient-to-r from-primary to-accent rounded-[28px] p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
        <div class="absolute right-0 top-0 w-48 h-48 bg-white/10 rounded-full blur-[60px] group-hover:bg-white/20 transition-all duration-700"></div>
        <div class="relative z-10">
          <div class="flex justify-between items-start mb-2">
            <span class="text-xs font-bold text-white/60 uppercase tracking-widest">净利润 (Profit)</span>
          </div>
          <div class="text-[46px] font-bold tracking-tight mb-6 leading-none font-mono">
            <span class="text-2xl text-white/70 font-sans mr-1">¥</span>{{ formatCurrency(dailyStats.profit) }}
          </div>
          <div class="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
            <div>
              <div class="text-[10px] text-white/60 mb-0.5">营收</div>
              <div class="text-base font-bold">¥{{ formatCurrency(dailyStats.revenue) }}</div>
            </div>
            <div class="border-l border-white/10 pl-3">
              <div class="text-[10px] text-white/60 mb-0.5">订单</div>
              <div class="text-base font-bold">{{ dailyStats.count }}</div>
            </div>
            <div class="border-l border-white/10 pl-3">
              <div class="text-[10px] text-white/60 mb-0.5">利润率</div>
              <div class="text-base font-bold text-white">{{ dailyStats.marginRate }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 趋势图表 (重构版) -->
      <div class="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
        <!-- 标题与概览 -->
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="font-bold text-primary text-sm flex items-center gap-1 mb-2">
              <i class="ph-bold ph-chart-line text-accent"></i> 利润趋势
            </h3>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-bold text-primary">￥{{ formatCurrency(trendStats.total) }}</span>
              <div class="flex items-center gap-1" :class="{
                'text-success': trendStats.trend === 'up',
                'text-danger': trendStats.trend === 'down',
                'text-gray-400': trendStats.trend === 'stable'
              }">
                <i v-if="trendStats.trend === 'up'" class="ph-bold ph-trend-up text-lg"></i>
                <i v-else-if="trendStats.trend === 'down'" class="ph-bold ph-trend-down text-lg"></i>
                <i v-else class="ph-bold ph-minus text-lg"></i>
                <span class="text-xs font-bold">{{ Math.abs(trendStats.trendPercent) }}%</span>
              </div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] text-gray-400 mb-1">近7天总计</div>
            <div class="text-xs text-gray-500">均值 ￥{{ formatCurrency(trendStats.avg) }}</div>
          </div>
        </div>

        <!-- 数据详情提示 -->
        <Transition name="fade" mode="out-in">
          <div v-if="selectedBarIndex !== null" class="mb-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-3 border border-primary/10">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <i class="ph-bold ph-calendar text-primary text-sm"></i>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500">日期</div>
                  <div class="text-xs font-bold text-primary">{{ getBarDateLabel(selectedBarIndex) }}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-[10px] text-gray-500 mb-0.5">当日利润</div>
                <div class="text-lg font-bold text-primary">¥{{ formatCurrency(chartData.values[selectedBarIndex]) }}</div>
              </div>
            </div>
          </div>
          <div v-else class="mb-4 text-center text-xs text-gray-400 py-2">
            <i class="ph-duotone ph-hand-tap text-lg opacity-50"></i>
            <p>点击柱子查看详情</p>
          </div>
        </Transition>
        
        <!-- 柱状图 -->
        <div class="h-60 flex items-end gap-1.5 relative overflow-x-auto hide-scrollbar px-2 -mx-2">
          <!-- Y轴参考线 -->
          <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div class="border-t border-dashed border-gray-200"></div>
            <div class="border-t border-dashed border-gray-200"></div>
            <div class="border-t border-dashed border-gray-200"></div>
          </div>

          <!-- 柱子 -->
          <div 
            v-for="(point, i) in chartData.labels" 
            :key="i" 
            @click="toggleBar(i)"
            class="flex-1 flex flex-col items-center gap-2 group cursor-pointer relative z-10 min-w-[40px] active:opacity-70 transition-opacity"
          >
            <!-- 柱状条容器 -->
            <div class="w-full bg-gray-50 rounded-t-xl relative overflow-hidden h-40 flex items-end">
              <!-- 背景渐变 -->
              <div 
                class="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              ></div>
              
              <!-- 柱子 -->
              <div 
                class="w-full rounded-t-xl transition-all duration-500 min-h-[0px] relative overflow-hidden"
                :class="[
                  point.active ? 'bg-gradient-to-t from-primary to-accent shadow-lg' : 'bg-gradient-to-t from-primary/60 to-accent/60',
                  selectedBarIndex === i ? 'shadow-xl ring-2 ring-primary/30' : ''
                ]"
                :style="{height: chartData.values[i] === 0 ? '0%' : Math.max(30, (chartData.values[i] / chartData.max) * 70 + 30) + '%'}"
              >
                <!-- 顶部高亮 -->
                <div class="absolute top-0 inset-x-0 h-1 bg-white/30"></div>
                
                <!-- 数值标签 -->
                <Transition name="fade">
                  <div 
                    v-if="selectedBarIndex === i" 
                    class="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#0A84FF] text-white px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shadow-lg"
                  >
                    ￥{{ formatCurrency(chartData.values[i]) }}
                    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#0A84FF]"></div>
                  </div>
                </Transition>
              </div>
            </div>
            
            <!-- 日期标签 -->
            <div class="flex flex-col items-center gap-0.5">
              <span 
                class="text-[10px] font-bold transition-all duration-300"
                :class="[
                  point.active ? 'text-primary scale-110' : 'text-gray-400',
                  selectedBarIndex === i ? 'text-accent scale-105' : ''
                ]"
              >
                {{ point.label }}
              </span>
              <div 
                v-if="point.active" 
                class="w-1 h-1 rounded-full bg-[#0A84FF]"
              ></div>
            </div>
          </div>
        </div>

        <!-- 底部统计信息 -->
        <div class="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
          <div class="text-center">
            <div class="text-[10px] text-gray-400 mb-1">最高</div>
            <div class="text-sm font-bold text-success">￥{{ formatCurrency(trendStats.max) }}</div>
          </div>
          <div class="text-center border-l border-r border-gray-100">
            <div class="text-[10px] text-gray-400 mb-1">平均</div>
            <div class="text-sm font-bold text-primary">￥{{ formatCurrency(trendStats.avg) }}</div>
          </div>
          <div class="text-center">
            <div class="text-[10px] text-gray-400 mb-1">最低</div>
            <div class="text-sm font-bold text-gray-400">￥{{ formatCurrency(trendStats.min) }}</div>
          </div>
        </div>
      </div>

      <!-- 4. 次级指标网格 -->
      <div class="grid grid-cols-2 gap-4">
        <!-- 日均销售额 -->
        <div class="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100">
          <div class="text-[10px] text-gray-400 font-bold uppercase mb-1">日均销售额</div>
          <div class="text-2xl font-bold text-primary">¥{{ formatCurrency(dailyStats.revenue) }}</div>
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
              <div class="text-[10px] text-gray-300">{{ order.items.length }} 种商品</div>
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
                  <div class="text-sm font-bold text-gray-600">{{ new Date(currentOrder.timestamp).toLocaleString() }}</div>
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