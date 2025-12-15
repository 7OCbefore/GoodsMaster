<script setup>
import { ref, watch, nextTick } from 'vue';
const props = defineProps(['show', 'title', 'content', 'confirmText', 'isDanger', 'isInput', 'inputValue']);
const emit = defineEmits(['close', 'confirm', 'update:inputValue']);

const inputRef = ref(null);
watch(() => props.show, (val) => {
  if (val && props.isInput) nextTick(() => inputRef.value?.focus());
});
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[900] flex items-center justify-center p-6">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>
      <div class="bg-white w-full max-w-[300px] rounded-[24px] shadow-2xl overflow-hidden text-center z-10 animate-pop relative">
        <div class="p-6">
          <h3 class="text-[18px] font-bold text-slate-900 mb-2">{{ title }}</h3>
          <p class="text-[14px] text-gray-500 leading-relaxed mb-5 whitespace-pre-line">{{ content }}</p>
          <div v-if="isInput" class="mb-2 bg-gray-50 rounded-xl p-2 border border-gray-100 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <input 
              ref="inputRef"
              :value="inputValue" 
              @input="$emit('update:inputValue', $event.target.value)"
              type="tel" 
              class="w-full bg-transparent text-center font-bold text-2xl outline-none text-primary placeholder-slate-300" 
              placeholder="0.00"
            >
          </div>
        </div>
        <div class="grid grid-cols-2 border-t border-gray-100 divide-x divide-gray-100">
          <button @click="$emit('close')" class="py-3.5 text-[16px] text-gray-500 font-medium active:bg-gray-50 transition-colors">取消</button>
          <button @click="$emit('confirm')" class="py-3.5 text-[16px] font-bold active:bg-gray-50 transition-colors" :class="isDanger ? 'text-red-500' : 'text-primary'">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>