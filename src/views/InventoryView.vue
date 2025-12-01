<script setup>
import { ref, computed } from 'vue';
import { useStore } from '../composables/useStore';
const { inventoryList, totalInventoryValue, totalInventoryCount, formatCurrency, goodsList } = useStore();
const search = ref('');
const filteredList = computed(() => {
  if (!search.value) return inventoryList.value;
  return inventoryList.value.filter(i => i.name.includes(search.value));
});
</script>
<template>
  <div class="p-5 space-y-5 animate-fade-in">
    <header class="flex justify-between items-center py-1"><h1 class="text-[28px] font-extrabold text-primary tracking-tight">库存资产</h1></header>
    <div class="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[28px] p-6 text-white shadow-2xl relative overflow-hidden">
      <div class="relative z-10">
        <div class="flex items-center gap-2 text-white/60 text-[13px] font-bold uppercase mb-1"><i class="ph-fill ph-vault"></i> 仓库总成本</div>
        <div class="text-[36px] font-bold tracking-tight mb-6"><span class="text-[24px] opacity-60">¥</span>{{ formatCurrency(totalInventoryValue) }}</div>
        <div class="flex gap-6 border-t border-white/10 pt-4">
          <div><div class="text-[11px] text-white/40 mb-0.5 font-bold uppercase">SKU 种类</div><div class="text-[16px] font-bold">{{ inventoryList.length }}</div></div>
          <div class="border-l border-white/10 pl-6"><div class="text-[11px] text-white/40 mb-0.5 font-bold uppercase">总库存量</div><div class="text-[16px] font-bold">{{ totalInventoryCount }} <span class="text-[12px] opacity-60">件</span></div></div>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
      <button @click="search=''" :class="!search?'bg-primary text-white':'bg-white border text-gray-600'" class="px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap shadow-sm">全部</button>
      <button v-for="g in goodsList" :key="g" @click="search=g" :class="search===g?'bg-primary text-white':'bg-white border text-gray-600'" class="px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap shadow-sm">{{g}}</button>
    </div>
    <div class="space-y-3 pb-24">
      <div v-for="item in filteredList" :key="item.name" class="bg-white rounded-[20px] p-4 shadow-sm border border-gray-50 flex justify-between">
        <div class="flex-1 overflow-hidden mr-4"><h3 class="font-bold text-[16px] text-primary truncate mb-1.5">{{item.name}}</h3><div class="flex items-center gap-2"><span class="bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-md">成本 ¥{{formatCurrency(item.averageCost)}}</span></div></div>
        <div class="text-right"><div class="text-[20px] font-bold text-primary">{{item.quantity}}</div><div class="text-[10px] text-gray-400 font-bold uppercase">库存</div></div>
      </div>
    </div>
  </div>
</template>