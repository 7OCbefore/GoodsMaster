<script setup>
import { ref, computed } from 'vue';
import { useStore } from '../composables/useStore';

const { packages, formatCurrency } = useStore();
const emit = defineEmits(['openScan', 'openBatchAdd', 'toggleVerify', 'deleteItem', 'editPrice', 'toast']);

const filter = ref('pending');
const searchQuery = ref('');

const pendingCount = computed(() => packages.value.filter(p => !p.verified).length);
const verifiedCount = computed(() => packages.value.filter(p => p.verified).length);

const filteredList = computed(() => {
  let list = packages.value.filter(p => filter.value === 'pending' ? !p.verified : p.verified);
  if (searchQuery.value) {
    const q = searchQuery.value.toUpperCase();
    list = list.filter(p => p.tracking.includes(q) || p.content.includes(q));
  }
  return list.sort((a,b) => b.timestamp - a.timestamp);
});
</script>

<template>
  <div class="p-5 space-y-5 animate-fade-in">
    <header class="flex justify-between items-center py-1">
      <h1 class="text-[28px] font-extrabold text-primary tracking-tight">进货管理</h1>
      <div class="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-white shadow-sm flex items-center justify-center font-bold text-xs text-primary">A</div>
    </header>

    <div class="bg-white rounded-2xl flex items-center px-4 py-3 shadow-sm border border-gray-100 transition-all focus-within:ring-2 focus-within:ring-primary/10">
      <i class="ph ph-magnifying-glass text-gray-400 text-lg mr-2"></i>
      <input v-model="searchQuery" type="text" placeholder="搜索单号或商品..." class="bg-transparent w-full outline-none text-[15px] placeholder-gray-400 font-medium text-primary">
      <button v-if="searchQuery" @click="searchQuery = ''" class="text-gray-400"><i class="ph-fill ph-x-circle"></i></button>
    </div>

    <div class="flex p-1 bg-gray-200/60 rounded-[14px]">
      <button @click="filter = 'pending'" :class="filter === 'pending' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'" class="flex-1 py-2 text-[13px] font-bold rounded-[11px] transition-all">待收货 ({{ pendingCount }})</button>
      <button @click="filter = 'verified'" :class="filter === 'verified' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'" class="flex-1 py-2 text-[13px] font-bold rounded-[11px] transition-all">已入库 ({{ verifiedCount }})</button>
    </div>

    <div class="space-y-3 pb-24">
      <div v-if="filteredList.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <i class="ph ph-package text-4xl mb-3 opacity-20"></i>
        <span class="text-[14px] font-medium opacity-60">暂无数据</span>
      </div>
      
      <div v-for="pkg in filteredList" :key="pkg.id" class="bg-white rounded-[20px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-50 relative overflow-hidden transition-all active:scale-98">
        <div class="flex justify-between items-start mb-2">
          <h3 class="font-bold text-[17px] text-primary leading-tight flex-1 mr-3">{{ pkg.content }}</h3>
          <span class="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-[13px] font-bold">x{{ pkg.quantity }}</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <div class="bg-gray-50 text-gray-500 font-mono text-[13px] font-medium px-2 py-1 rounded-[6px] tracking-wide border border-gray-100">{{ pkg.tracking }}</div>
          <div @click.stop="emit('editPrice', pkg)" class="flex items-center text-[12px] px-2 py-1 rounded-[6px] transition-colors cursor-pointer border" :class="pkg.costPrice > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'">
            <i class="ph-bold ph-tag mr-1 text-[10px]"></i>
            <span v-if="pkg.costPrice > 0" class="font-bold">¥{{ pkg.costPrice }}</span>
            <span v-else class="font-bold">补填进价</span>
          </div>
        </div>
        <div class="flex gap-3 pt-3 border-t border-gray-50">
          <button @click.stop="emit('toggleVerify', pkg.id)" class="flex-1 py-3 rounded-[14px] text-[15px] font-bold transition-all flex items-center justify-center gap-1.5" :class="pkg.verified ? 'bg-gray-100 text-gray-500' : 'bg-primary text-white shadow-lg shadow-slate-200'">
            <i :class="pkg.verified ? 'ph-bold ph-arrow-u-up-left' : 'ph-bold ph-check'"></i>
            <span>{{ pkg.verified ? '撤销入库' : '确认收货' }}</span>
          </button>
          <button @click.stop="emit('deleteItem', pkg.id)" class="w-12 flex items-center justify-center bg-gray-50 text-gray-400 rounded-[14px] active:bg-red-50 active:text-red-500 transition-colors border border-gray-100">
            <i class="ph-bold ph-trash text-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <div class="fixed bottom-24 right-5 flex flex-col gap-4 z-40">
      <button @click="emit('openScan')" class="w-14 h-14 bg-white text-primary border border-gray-100 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform">
        <i class="ph-bold ph-scan text-2xl"></i>
      </button>
      <button @click="emit('openBatchAdd')" class="w-14 h-14 bg-primary text-white rounded-full shadow-2xl shadow-slate-400/50 flex items-center justify-center active:scale-90 transition-transform">
        <i class="ph-bold ph-plus text-2xl"></i>
      </button>
    </div>
  </div>
</template>