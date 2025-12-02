<script setup>
import { ref, reactive, provide } from 'vue';
import InboxView from './views/InboxView.vue';
import InventoryView from './views/InventoryView.vue';
import SalesView from './views/SalesView.vue';
import DashboardView from './views/DashboardView.vue';
import SettingsView from './views/SettingsView.vue';
import Toast from './components/Toast.vue';
import Dialog from './components/Dialog.vue';

const currentTab = ref('dashboard');

// --- Global UI State ---
const toastState = reactive({ show: false, msg: '', type: 'success' });
const dialogState = reactive({ 
  show: false, title: '', content: '', confirmText: '确定', 
  isDanger: false, isInput: false, inputValue: '', action: null 
});

// --- Provide Global Helpers ---
const showToast = (msg, type = 'success') => {
  toastState.msg = msg; toastState.type = type; toastState.show = true;
  setTimeout(() => toastState.show = false, 2500);
};

const showDialog = (options) => {
  Object.assign(dialogState, {
    show: true, isInput: false, isDanger: false, inputValue: '',
    ...options
  });
};

const closeDialog = () => dialogState.show = false;

provide('showToast', showToast);
provide('showDialog', showDialog);

// Dialog Confirm Handler
const handleDialogConfirm = () => {
  if (dialogState.action) {
    // 如果是 Input 模式，传递输入值
    dialogState.action(dialogState.inputValue); 
  }
  closeDialog();
};

const tabs = [
  { id: 'inbox', label: '进货', icon: 'ph-tray' },
  { id: 'inventory', label: '库存', icon: 'ph-package' },
  { id: 'dashboard', label: '总览', icon: 'ph-chart-pie-slice' },
  { id: 'sales', label: '开单', icon: 'ph-storefront' },
  { id: 'settings', label: '设置', icon: 'ph-gear' },
];
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-surface text-primary font-sans relative">
    
    <!-- 全局组件 -->
    <Toast :show="toastState.show" :msg="toastState.msg" :type="toastState.type" />
    <Dialog 
      :show="dialogState.show" 
      :title="dialogState.title"
      :content="dialogState.content"
      :confirmText="dialogState.confirmText"
      :isDanger="dialogState.isDanger"
      :isInput="dialogState.isInput"
      :inputValue="dialogState.inputValue"
      @update:inputValue="val => dialogState.inputValue = val"
      @close="closeDialog"
      @confirm="handleDialogConfirm"
    />

    <!-- 主视图区域 -->
    <div class="flex-1 overflow-hidden relative">
      <KeepAlive>
        <component :is="currentTab === 'inbox' ? InboxView : 
                        currentTab === 'inventory' ? InventoryView : 
                        currentTab === 'dashboard' ? DashboardView : 
                        currentTab === 'sales' ? SalesView : SettingsView" />
      </KeepAlive>
    </div>

    <!-- 底部导航栏 -->
    <nav class="glass-nav pb-safe fixed bottom-0 w-full z-50">
      <div class="flex justify-between items-center h-[60px] px-2">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="currentTab = tab.id"
          class="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-transform duration-200"
          :class="currentTab === tab.id ? 'text-primary' : 'text-gray-400'"
        >
          <i :class="[currentTab === tab.id ? 'ph-fill' : 'ph-bold', tab.icon]" class="text-2xl"></i>
          <span class="text-[10px] font-medium">{{ tab.label }}</span>
        </button>
      </div>
    </nav>

  </div>
</template>