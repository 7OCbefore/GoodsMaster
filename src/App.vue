<script setup>
import { ref, reactive, provide, onMounted, computed, defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { migrateLocalStorageToSupabase, clearLocalStorageAfterMigration } from './services/dataMigrationService';
import { useStore } from './composables/useSupabaseStore';
import Toast from './components/Toast.vue';
import Dialog from './components/Dialog.vue';

// Async components for code splitting
const InboxView = defineAsyncComponent(() => import('./views/InboxView.vue'));
const InventoryView = defineAsyncComponent(() => import('./views/InventoryView.vue'));
const SalesView = defineAsyncComponent(() => import('./views/SalesView.vue'));
const DashboardView = defineAsyncComponent(() => import('./views/DashboardView.vue'));
const SettingsView = defineAsyncComponent(() => import('./views/SettingsView.vue'));

// Default user for non-authenticated system
const user = ref({ id: 'default-user-id', email: 'default@example.com' });
const authLoading = ref(false);

// Offline mode state
const offlineMode = ref(false);

// Tab navigation
const currentTab = ref('dashboard');

// --- Global UI State ---
const toastState = reactive({ show: false, msg: '', type: 'success' });
const dialogState = reactive({ 
  show: false, title: '', content: '', confirmText: '确定', 
  isDanger: false, isInput: false, inputValue: '', action: null 
});

// Initialize the store with the default user
onMounted(async () => {
  try {
    // Initialize store with default user
    const store = useStore();
    if (store.user) {
      store.user.value = user.value;
    }
    
    // Load data for the default user
    if (store.loadData) {
      await store.loadData(user.value.id);
    } else {
      // 如果没有loadData方法，说明是本地存储版本，直接使用现有数据
      console.log('Using local storage data');
    }
  } catch (error) {
    console.error('Error during initialization:', error);
    showToast('初始化过程中出现错误', 'error');
  }
});

// 离线模式
const useOfflineMode = () => {
  offlineMode.value = true;
  user.value = { id: 'offline-user' }; // 设置一个虚拟用户ID
  showToast('已切换到离线模式', 'info');
};

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
provide('currentUser', user);

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
  <!-- Main application -->
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
    <div class="flex-1 overflow-hidden relative mt-10 pt-6">
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