<script setup>
import { useStore } from '../composables/useStore';
const { salesStats, topSelling, lowStockItems, formatCurrency } = useStore();
</script>
<template>
  <div class="p-5 space-y-5 animate-fade-in">
    <header class="flex justify-between items-center py-1"><h1 class="text-[28px] font-extrabold text-primary tracking-tight">经营总览</h1><div class="text-xs font-bold bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full">{{ new Date().toLocaleDateString() }}</div></header>
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2 bg-primary rounded-[24px] p-6 text-white shadow-xl relative overflow-hidden">
        <div class="absolute -right-5 -top-5 w-32 h-32 bg-accent/20 rounded-full blur-3xl"></div>
        <div class="relative z-10"><div class="text-[13px] font-bold text-accent uppercase tracking-wider mb-1">今日净毛利</div><div class="text-[40px] font-bold tracking-tight mb-2 leading-none"><span class="text-[24px] opacity-60">¥</span>{{ formatCurrency(salesStats.todayProfit) }}</div><div class="flex items-center gap-2 text-[13px] text-white/50 font-medium"><span class="px-2 py-0.5 bg-white/10 rounded text-white">毛利率 {{ salesStats.marginRate }}%</span><span>流水 ¥{{ formatCurrency(salesStats.todayRevenue) }}</span></div></div>
      </div>
      <div class="col-span-2 bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
        <div class="flex justify-between mb-4"><h3 class="font-bold text-primary text-[15px]">7天趋势</h3></div>
        <div class="h-24 flex items-end justify-between gap-2 px-1"><div v-for="i in 7" :key="i" class="w-full bg-slate-100 rounded-t-sm h-full relative overflow-hidden"><div class="absolute bottom-0 w-full bg-primary" :style="{height:(20+Math.random()*60)+'%'}"></div></div></div>
      </div>
      <div class="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100 flex flex-col justify-between"><h2 class="font-bold text-[14px] text-primary mb-2 flex items-center"><i class="ph-fill ph-warning text-red-500 mr-1.5"></i> 缺货预警</h2><div v-if="!lowStockItems.length" class="text-xs text-gray-400">库存健康</div><div v-else class="space-y-2"><div v-for="item in lowStockItems.slice(0,2)" class="flex justify-between text-xs font-medium"><span class="truncate w-16">{{item}}</span><span class="text-red-500">补</span></div></div></div>
      <div class="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100 flex flex-col justify-between"><h2 class="font-bold text-[14px] text-primary mb-2 flex items-center"><i class="ph-fill ph-fire text-accent mr-1.5"></i> 本月热销</h2><div v-if="!topSelling.length" class="text-xs text-gray-400">暂无数据</div><div v-else class="space-y-2"><div v-for="item in topSelling.slice(0,2)" class="flex justify-between text-xs font-medium"><span class="truncate w-16">{{item.name}}</span><span class="bg-gray-100 px-1.5 rounded">{{item.qty}}</span></div></div></div>
    </div>
  </div>
</template>