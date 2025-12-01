<script setup>
import { ref, computed } from 'vue';
import { useStore } from '../composables/useStore';

const { inventoryList, sellPrice, formatCurrency, salesHistory } = useStore();
const emit = defineEmits(['addToCart', 'openCart', 'openSettings']);
const props = defineProps(['cartItemCount', 'cartTotal']);

const filter = ref('all');
const search = ref('');

const displayList = computed(() => {
  let list = inventoryList.value;
  
  if (filter.value === 'hot') {
    const salesMap = {};
    salesHistory.value.forEach(s => s.items.forEach(i => salesMap[i.name] = (salesMap[i.name]||0)+i.quantity));
    list = list.slice().sort((a,b) => (salesMap[b.name]||0) - (salesMap[a.name]||0));
  } else if (filter.value === 'warn') {
    list = list.filter(i => i.quantity < 5);
  }

  if (search.value) list = list.filter(i => i.name.includes(search.value));
  return list;
});
</script>

<template>
  <div class="flex flex-col h-full bg-[#F5F5F7]">
    <div class="bg-white px-5 pt-safe pb-4 shadow-sm z-20 sticky top-0">
      <div class="flex justify-between items-center mb-4 mt-2">
        <h1 class="text-[24px] font-extrabold text-primary">开单收银</h1>
        <button class="w-10 h-10 rounded-full bg-gray-50 text-slate-600 flex items-center justify-center" @click="emit('openSettings')"><i class="ph-bold ph-gear text-xl"></i></button>
      </div>
      <div class="flex gap-2">
        <button @click="filter='all'" :class="filter==='all'?'bg-primary text-white':'bg-slate-100 text-slate-500'" class="px-4 py-2 rounded-xl text-xs font-bold transition-colors">全部商品</button>
        <button @click="filter='hot'" :class="filter==='hot'?'bg-primary text-white':'bg-slate-100 text-slate-500'" class="px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"><i class="ph-fill ph-fire text-accent"></i> 热销</button>
        <button @click="filter='warn'" :class="filter==='warn'?'bg-primary text-white':'bg-slate-100 text-slate-500'" class="px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"><i class="ph-fill ph-warning text-red-400"></i> 预警</button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 pb-32 bg-slate-50">
      <div v-if="displayList.length === 0" class="py-20 text-center text-slate-400">
        <i class="ph-duotone ph-storefront text-4xl mb-2 opacity-50"></i>
        <p class="text-sm">暂无商品</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="item in displayList" :key="item.name" @click="emit('addToCart', item)" class="bg-white p-4 rounded-[20px] shadow-sm border border-slate-100 flex flex-col justify-between h-36 relative active:scale-[0.98] transition-all group border-b-4 border-b-transparent active:border-b-primary">
          <div class="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded" :class="item.quantity < 5 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'">{{ item.quantity }}</div>
          <div><div class="font-bold text-[15px] text-primary leading-snug line-clamp-2">{{ item.name }}</div></div>
          <div class="mt-auto pt-3 flex items-end justify-between">
            <div>
              <div class="text-[10px] text-slate-400 font-medium">售价</div>
              <div class="text-[16px] font-extrabold text-primary">
                <span v-if="sellPrice[item.name]">¥{{ sellPrice[item.name] }}</span>
                <span v-else class="text-slate-300 text-sm">--</span>
              </div>
            </div>
            <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 group-active:scale-110 transition-transform"><i class="ph-bold ph-plus"></i></div>
          </div>
        </div>
      </div>
    </div>

    <div class="fixed bottom-[80px] left-4 right-4 z-30 transition-transform duration-300" :class="cartItemCount > 0 ? 'translate-y-0' : 'translate-y-[200%]'">
      <div class="bg-primary text-white rounded-[24px] p-2 pl-6 pr-2 shadow-2xl shadow-primary/40 flex items-center justify-between border border-white/10">
        <div @click="emit('openCart')" class="flex flex-col cursor-pointer">
          <div class="text-[11px] text-white/60 font-bold uppercase">共 {{ cartItemCount }} 件商品</div>
          <div class="text-[20px] font-bold font-mono">¥{{ formatCurrency(cartTotal) }}</div>
        </div>
        <button @click="emit('openCart')" class="bg-white text-primary px-6 py-3.5 rounded-[20px] font-bold text-[15px] flex items-center gap-2 active:scale-95 transition-transform">
          去结算 <i class="ph-bold ph-arrow-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>