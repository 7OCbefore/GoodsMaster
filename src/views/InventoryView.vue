<script setup>
import { ref, computed, onMounted } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { useStore } from '../composables/useStore';

const { inventoryList, totalInventoryValue, totalInventoryCount, formatCurrency, goodsList } = useStore();

const search = ref('');
const filteredList = computed(() => {
  if (!search.value) return inventoryList.value;
  return inventoryList.value.filter(i => i.name.includes(search.value));
});

// 虚拟滚动配置
const parentRef = ref();

const rowVirtualizer = useVirtualizer({
  count: filteredList.value.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 92, // 根据实际元素高度调整，包括 padding
  overscan: 5,
});</script>

<template>
  <div class="p-5 pt-safe space-y-5 pb-[90px] h-full overflow-y-auto bg-surface">
    <header class="py-2">
      <h1 class="text-[32px] font-bold text-primary tracking-tight">库存资产</h1>
    </header>

    <div class="bg-gradient-to-r from-primary to-accent rounded-[32px] p-6 shadow-xl relative overflow-hidden border border-gray-100">
      <div class="relative z-10">
        <div class="flex items-center gap-2 text-white/60 text-xs font-bold uppercase mb-2 tracking-widest">
          <i class="ph-fill ph-vault text-white"></i> 仓库总成本
        </div>
        <div class="text-[40px] font-bold tracking-tight mb-8 font-mono text-white">
          <span class="text-[24px] text-white/70 font-sans">¥</span>{{ formatCurrency(totalInventoryValue) }}
        </div>
        <div class="flex gap-8 border-t border-white/10 pt-4">
          <div>
            <div class="text-[10px] text-white/60 mb-1 font-bold uppercase">SKU 种类</div>
            <div class="text-xl font-bold text-white">{{ inventoryList.length }}</div>
          </div>
          <div class="border-l border-white/10 pl-8">
            <div class="text-[10px] text-white/60 mb-1 font-bold uppercase">总库存量</div>
            <div class="text-xl font-bold text-white">{{ totalInventoryCount }} <span class="text-xs text-white/70 font-medium">件</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar py-2">
      <button @click="search=''" :class="!search?'bg-[#0A84FF] text-white':'bg-white text-gray-500 border border-gray-100'" class="px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition-colors">全部</button>
      <button v-for="g in goodsList" :key="g" @click="search=g" :class="search===g?'bg-[#0A84FF] text-white':'bg-white text-gray-500 border border-gray-100'" class="px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition-colors">{{g}}</button>
    </div>

    <div ref="parentRef" class="space-y-3 h-[calc(100vh-340px)] overflow-y-auto">
      <div :style="{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }" class="virtualized-list">
        <div
          v-for="virtualRow in rowVirtualizer.getVirtualItems()"
          :key="virtualRow.key"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }"
        >
          <div class="px-1 py-1">
            <div class="bg-white rounded-[24px] p-5 shadow-sm border border-gray-50 flex justify-between items-center active:scale-[0.98] transition-transform h-full">
              <div class="flex-1 overflow-hidden mr-4">
                <h3 class="font-bold text-[17px] text-primary truncate mb-1">{{filteredList[virtualRow.index].name}}</h3>
                <div class="flex items-center gap-2">
                  <span class="bg-surface text-gray-500 text-[10px] font-bold px-2 py-1 rounded-md">成本 ¥{{formatCurrency(filteredList[virtualRow.index].averageCost)}}</span>
                </div>
              </div>
              <div class="text-right">
                <div class="text-[24px] font-bold text-primary leading-none">{{filteredList[virtualRow.index].quantity}}</div>
                <div class="text-[10px] text-gray-400 font-bold uppercase mt-1">库存</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>