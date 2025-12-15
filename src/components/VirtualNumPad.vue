<template>
  <Teleport to="body">
    <div 
      v-if="visible" 
      class="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col"
      @click="handleOverlayClick"
    >
      <!-- 遮罩层 -->
      <div 
        class="ml-auto mr-4 mt-12 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center"
        @click="close"
      >
        <i class="ph ph-x text-xl text-gray-700"></i>
      </div>
      
      <!-- 数字键盘 -->
      <div class="bg-white rounded-t-2xl p-4 pb-8 mx-auto w-full max-w-md mt-auto">
        <div class="grid grid-cols-3 gap-3">
          <button 
            v-for="key in keys" 
            :key="key.value"
            class="h-16 rounded-xl text-xl font-medium flex items-center justify-center active:scale-95 transition-transform"
            :class="key.type === 'action' ? 'bg-red-500 text-white' : 'bg-gray-100'"
            @click="handleKeyPress(key)"
          >
            {{ key.label }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Teleport } from 'vue';

export interface Props {
  visible: boolean;
}

export interface Emit {
  (e: 'input', value: string): void;
  (e: 'delete'): void;
  (e: 'confirm', value: string): void;
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

// 定义键盘按键
const keys = [
  { label: '1', value: '1', type: 'number' },
  { label: '2', value: '2', type: 'number' },
  { label: '3', value: '3', type: 'number' },
  { label: '4', value: '4', type: 'number' },
  { label: '5', value: '5', type: 'number' },
  { label: '6', value: '6', type: 'number' },
  { label: '7', value: '7', type: 'number' },
  { label: '8', value: '8', type: 'number' },
  { label: '9', value: '9', type: 'number' },
  { label: '.', value: '.', type: 'number' },
  { label: '0', value: '0', type: 'number' },
  { label: '←', value: 'backspace', type: 'action' },
];

// 处理按键点击
const handleKeyPress = (key: typeof keys[number]) => {
  // 触发震动反馈
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }

  if (key.type === 'number') {
    emit('input', key.value);
  } else if (key.value === 'backspace') {
    emit('delete');
  }
};

// 处理遮罩层点击
const handleOverlayClick = (event: Event) => {
  if (event.target === event.currentTarget) {
    close();
  }
};

// 关闭键盘
const close = () => {
  emit('close');
};
</script>