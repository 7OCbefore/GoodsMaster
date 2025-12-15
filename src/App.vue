<script setup lang="ts">
import { ref, reactive, provide, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStore } from './composables/useStore';
import { syncService } from './services/syncService';
import Toast from './components/Toast.vue';
import Dialog from './components/Dialog.vue';

const router = useRouter();
const route = useRoute();

// --- 数据加载状态 ---
const { loadFromDB, isLoading, hasLoaded } = useStore();
const isAppLoading = ref(true);
const loadError = ref(false);

onMounted(async () => {
  try {
    // 首先加载本地数据以保证快速响应
    await loadFromDB();
    
    // 然后尝试从云端同步数据（如果已配置）
    try {
      // 自动执行云端同步
      await syncService.sync();
    } catch (syncError) {
      console.warn('云端同步失败，将继续使用本地数据:', syncError);
      // 即使同步失败，也不应阻止应用启动
    }
  } catch (error) {
    console.error('应用启动时数据加载失败:', error);
    loadError.value = true;
  } finally {
    isAppLoading.value = false;
  }
});

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
  { id: 'inbox', label: '进货', icon: 'ph-tray', path: '/inbox' },
  { id: 'inventory', label: '库存', icon: 'ph-package', path: '/inventory' },
  { id: 'dashboard', label: '总览', icon: 'ph-chart-pie-slice', path: '/dashboard' },
  { id: 'sales', label: '开单', icon: 'ph-storefront', path: '/sales' },
  { id: 'settings', label: '设置', icon: 'ph-gear', path: '/settings' },
];

// 判断当前路由是否为一级 Tab
const isTabActive = (tabPath: string) => {
  return route.path === tabPath || 
         (tabPath === '/dashboard' && route.path === '/');
};
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-surface text-primary font-sans relative">

    <!-- 加载状态 -->
    <div v-if="isAppLoading" class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface">
      <div class="text-center space-y-4">
        <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-gray-500">正在加载数据...</p>
      </div>
    </div>

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
    <div v-if="!isAppLoading" class="flex-1 overflow-hidden relative">
      <!-- 为一级 Tab 页面添加 KeepAlive -->
      <KeepAlive include="DashboardView,InboxView,InventoryView,SalesView,SettingsView">
        <router-view v-slot="{ Component, route }">
          <transition 
            :name="route.meta?.depth === 1 ? 'slide-left' : 'fade'" 
            mode="out-in"
          >
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </KeepAlive>
    </div>

    <!-- 底部导航栏 -->
    <nav class="glass-nav pb-safe fixed bottom-0 w-full z-50">
      <div class="flex justify-between items-center h-[60px] px-2">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="router.push(tab.path)"
          class="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-transform duration-200"
          :class="isTabActive(tab.path) ? 'text-primary' : 'text-gray-400'"
        >
          <i :class="[isTabActive(tab.path) ? 'ph-fill' : 'ph-bold', tab.icon]" class="text-2xl"></i>
          <span class="text-[10px] font-medium">{{ tab.label }}</span>
        </button>
      </div>
    </nav>

  </div>
</template>

<style>
/* 路由转场动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-left-enter-active {
  transition: transform 0.3s ease;
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  right: 0;
}

.slide-left-leave-active {
  transition: transform 0.3s ease;
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  right: 0;
}

.slide-left-enter-from {
  transform: translateX(100%);
}

.slide-left-leave-to {
  transform: translateX(-100%);
}

/* 为二级页面添加样式 */
.page-container {
  height: calc(100vh - 60px);
  overflow-y: auto;
  position: relative;
}
</style>