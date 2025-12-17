<script setup>
import { inject, ref, onMounted } from 'vue';
import { useStore } from '../composables/useStore';
import { syncService } from '../services/syncService';
import pkg from '../../package.json';

const { packages, goodsList, salesHistory, sellPrice, products } = useStore();
const showToast = inject('showToast');
const showDialog = inject('showDialog');

// Loading states
const isSyncing = ref(false);
const isRecovering = ref(false);
const isBackingUp = ref(false);
const isExporting = ref(false);
const isImporting = ref(false);

// Last sync time
const lastSyncTime = ref(localStorage.getItem('last_sync_time') || '从未同步');

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return '从未同步';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Update last sync time display
onMounted(() => {
  lastSyncTime.value = formatDate(localStorage.getItem('last_sync_time'));
});

// Export backup
const exportBackup = async () => {
  isExporting.value = true;
  try {
    const data = JSON.stringify({
      packages: packages.value,
      goodsList: goodsList.value,
      salesHistory: salesHistory.value,
      sellPrice: sellPrice.value,
      products: products.value,
      version: '2.0'
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GoodsMaster_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showToast('备份已下载');
  } catch (error) {
    showToast('备份导出失败', 'error');
  } finally {
    isExporting.value = false;
  }
};

// Handle import
const handleImport = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  isImporting.value = true;
  
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      showDialog({
        title: '恢复数据',
        content: '此操作将覆盖当前所有数据，且不可撤销。确定继续吗？',
        isDanger: true,
        action: () => {
          if (data.packages) {
            // 数据清洗逻辑
            data.packages.forEach(p => {
              if (!p.batchId) {
                p.batchId = `FIX_${p.timestamp}_${p.content}`; 
              }
            });
            packages.value = data.packages;
          }
          if (data.goodsList) goodsList.value = data.goodsList;
          if (data.salesHistory) salesHistory.value = data.salesHistory;
          if (data.sellPrice) sellPrice.value = data.sellPrice;
          if (data.products) products.value = data.products;
          showToast('数据已恢复');
        }
      });
    } catch(err) {
      showToast('文件格式错误', 'error');
    } finally {
      isImporting.value = false;
    }
  };
  reader.onerror = () => {
    showToast('文件读取失败', 'error');
    isImporting.value = false;
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset
};

// Cloud sync
const syncWithCloud = async () => {
  if (isSyncing.value) return;
  
  isSyncing.value = true;
  try {
    showToast('正在同步云端数据...', 'info');
    await syncService.sync();
    lastSyncTime.value = formatDate(new Date().toISOString());
    showToast('云端同步成功');
  } catch (error) {
    console.error('云端同步失败:', error);
    showToast('云端同步失败: ' + error.message, 'error');
  } finally {
    isSyncing.value = false;
  }
};

// Recover from cloud
const recoverFromCloud = async () => {
  if (isRecovering.value) return;
  
  isRecovering.value = true;
  try {
    showToast('正在从云端恢复数据...', 'info');
    await syncService.recoverFromCloud();
    showToast('数据已从云端恢复');
  } catch (error) {
    console.error('云端恢复失败:', error);
    showToast('云端恢复失败: ' + error.message, 'error');
  } finally {
    isRecovering.value = false;
  }
};

// Backup to cloud
const backupToCloud = async () => {
  if (isBackingUp.value) return;
  
  isBackingUp.value = true;
  try {
    showToast('正在备份数据到云端...', 'info');
    await syncService.backupToCloud();
    lastSyncTime.value = formatDate(new Date().toISOString());
    showToast('数据已备份到云端');
  } catch (error) {
    console.error('云端备份失败:', error);
    showToast('云端备份失败: ' + error.message, 'error');
  } finally {
    isBackingUp.value = false;
  }
};

// Reset database
const resetDatabase = () => {
  showDialog({
    title: '清除所有数据',
    content: '此操作将永久删除所有本地数据，且不可恢复。确定继续吗？',
    isDanger: true,
    action: () => {
      try {
        packages.value = [];
        goodsList.value = [];
        salesHistory.value = [];
        sellPrice.value = {};
        products.value = [];
        showToast('所有数据已清除');
      } catch (error) {
        showToast('数据清除失败', 'error');
      }
    }
  });
};
</script>

<template>
  <div class="min-h-screen bg-black text-white pt-safe pb-24">
    <!-- Header -->
    <header class="px-5 py-6">
      <h1 class="text-3xl font-bold text-white/90">设置</h1>
      <p class="text-white/50 mt-1">管理应用偏好和数据</p>
    </header>

    <div class="px-5 space-y-6">
      <!-- Cloud Sync Section -->
      <section class="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
        <div class="p-5 border-b border-white/10">
          <h2 class="text-lg font-semibold text-white/90">云同步</h2>
          <p class="text-sm text-white/50 mt-1">跨设备同步您的数据</p>
        </div>
        
        <div class="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <p class="text-white/90 font-medium">上次同步</p>
            <p class="text-white/50 text-sm mt-1">{{ lastSyncTime }}</p>
          </div>
          <div class="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        
        <button 
          @click="syncWithCloud" 
          :disabled="isSyncing"
          class="w-full p-5 flex items-center justify-between active:bg-white/10 transition-colors disabled:opacity-50"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <i class="ph-bold ph-cloud-arrow-down text-xl text-indigo-400"></i>
            </div>
            <div class="text-left">
              <p class="text-white/90 font-medium">同步云端数据</p>
              <p class="text-white/50 text-sm">获取最新数据</p>
            </div>
          </div>
          <i v-if="!isSyncing" class="ph-bold ph-caret-right text-white/30"></i>
          <div v-else class="w-5 h-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin"></div>
        </button>
        
        <button 
          @click="backupToCloud" 
          :disabled="isBackingUp"
          class="w-full p-5 flex items-center justify-between active:bg-white/10 transition-colors disabled:opacity-50"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <i class="ph-bold ph-cloud-arrow-up text-xl text-blue-400"></i>
            </div>
            <div class="text-left">
              <p class="text-white/90 font-medium">备份到云端</p>
              <p class="text-white/50 text-sm">上传本地数据</p>
            </div>
          </div>
          <i v-if="!isBackingUp" class="ph-bold ph-caret-right text-white/30"></i>
          <div v-else class="w-5 h-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin"></div>
        </button>
        
        <button 
          @click="recoverFromCloud" 
          :disabled="isRecovering"
          class="w-full p-5 flex items-center justify-between active:bg-white/10 transition-colors disabled:opacity-50"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <i class="ph-bold ph-cloud-warning text-xl text-purple-400"></i>
            </div>
            <div class="text-left">
              <p class="text-white/90 font-medium">从云端恢复</p>
              <p class="text-white/50 text-sm">恢复被误删的数据</p>
            </div>
          </div>
          <i v-if="!isRecovering" class="ph-bold ph-caret-right text-white/30"></i>
          <div v-else class="w-5 h-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin"></div>
        </button>
      </section>

      <!-- Data Management Section -->
      <section class="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
        <div class="p-5 border-b border-white/10">
          <h2 class="text-lg font-semibold text-white/90">数据管理</h2>
          <p class="text-sm text-white/50 mt-1">导出或导入您的数据</p>
        </div>
        
        <button 
          @click="exportBackup" 
          :disabled="isExporting"
          class="w-full p-5 flex items-center justify-between active:bg-white/10 transition-colors disabled:opacity-50"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <i class="ph-bold ph-download-simple text-xl text-green-400"></i>
            </div>
            <div class="text-left">
              <p class="text-white/90 font-medium">导出数据</p>
              <p class="text-white/50 text-sm">保存为JSON文件</p>
            </div>
          </div>
          <i v-if="!isExporting" class="ph-bold ph-caret-right text-white/30"></i>
          <div v-else class="w-5 h-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin"></div>
        </button>
        
        <label class="block w-full p-5 flex items-center justify-between active:bg-white/10 transition-colors cursor-pointer">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <i class="ph-bold ph-upload-simple text-xl text-orange-400"></i>
            </div>
            <div class="text-left">
              <p class="text-white/90 font-medium">导入数据</p>
              <p class="text-white/50 text-sm">从JSON文件恢复</p>
            </div>
          </div>
          <input 
            type="file" 
            accept=".json" 
            class="hidden" 
            @change="handleImport"
            :disabled="isImporting"
          >
          <i v-if="!isImporting" class="ph-bold ph-caret-right text-white/30"></i>
          <div v-else class="w-5 h-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin"></div>
        </label>
      </section>

      <!-- Danger Zone -->
      <section class="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
        <div class="p-5 border-b border-white/10">
          <h2 class="text-lg font-semibold text-red-400">危险操作</h2>
          <p class="text-sm text-white/50 mt-1">谨慎操作以下功能</p>
        </div>
        
        <button 
          @click="resetDatabase"
          class="w-full p-5 flex items-center justify-between active:bg-white/10 transition-colors"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <i class="ph-bold ph-trash text-xl text-red-400"></i>
            </div>
            <div class="text-left">
              <p class="text-red-400 font-medium">清除所有数据</p>
              <p class="text-white/50 text-sm">永久删除所有本地数据</p>
            </div>
          </div>
          <i class="ph-bold ph-caret-right text-white/30"></i>
        </button>
      </section>
    </div>

    <!-- Footer -->
    <footer class="mt-12 px-5 text-center">
      <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
        <i class="ph-fill ph-package text-2xl text-white"></i>
      </div>
      <p class="text-white/90 font-bold text-lg">GoodsMaster Pro</p>
      <p class="text-white/50 text-sm mt-1">v{{ pkg.version }} (Premium Dark)</p>
      <p class="text-white/30 text-xs mt-4">离线优先 · 隐私保护 · 无服务器架构</p>
    </footer>
  </div>
</template>

<style scoped>
/* Add any additional styles if needed */
</style>