<script setup lang="ts">
import { ref, inject, onMounted } from 'vue';
import { useStore } from '../composables/useStore';
import { syncService } from '../services/syncService';
import { useRouter } from 'vue-router';
import { createUuid } from '../utils/uuid';

const { resetDatabase, exportBackup } = useStore();
const router = useRouter();
const showToast = inject('showToast') as (msg: string, type?: 'success' | 'error' | 'warning') => void;
const showDialog = inject('showDialog') as (options: any) => void;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const lastSyncTime = ref<string>('从未同步');
const isSyncing = ref(false);
const isBackingUp = ref(false);
const isRecovering = ref(false);
const isExporting = ref(false);

// Dynamically import package.json to get version
const appVersion = ref('vUnknown');
import('../../package.json').then((pkg) => {
  appVersion.value = pkg.version;
});

const updateSyncTime = () => {
  const time = localStorage.getItem('last_sync_time');
  if (time) {
    const date = new Date(time);
    lastSyncTime.value = date.toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
};

// --- Actions ---

const handleSync = async () => {
  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    await syncService.sync();
    updateSyncTime();
    showToast('同步成功', 'success');
  } catch (e) {
    console.error(e);
    showToast('同步失败，请检查网络', 'error');
  } finally {
    isSyncing.value = false;
  }
};

const handleBackup = async () => {
  if (isBackingUp.value) return;
  isBackingUp.value = true;
  try {
    await syncService.backupToCloud();
    updateSyncTime();
    showToast('备份成功', 'success');
  } catch (e) {
    console.error(e);
    showToast('备份失败', 'error');
  } finally {
    isBackingUp.value = false;
  }
};

const handleRecovery = async () => {
  if (isRecovering.value) return;
  isRecovering.value = true;
  try {
    await syncService.recoverFromCloud();
    updateSyncTime();
    showToast('数据已恢复', 'success');
  } catch (e) {
    console.error(e);
    showToast('恢复失败', 'error');
  } finally {
    isRecovering.value = false;
  }
};

const handleExport = async () => {
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    exportBackup();
    showToast('导出成功', 'success');
  } catch (e) {
    console.error(e);
    showToast('导出失败', 'error');
  } finally {
    isExporting.value = false;
  }
};

const handleImport = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target!.result as string);
      showDialog({
        title: '恢复数据',
        content: '此操作将覆盖当前所有数据，且不可撤销。确定继续吗？',
        isDanger: true,
        action: () => {
          const { packages, goodsList, salesHistory, sellPrice } = useStore();
          if (data.packages) {
            // --- 数据清洗逻辑 ---
            data.packages.forEach((p: any) => {
              // 如果没有 batchId，尝试生成一个
              if (!p.batchId) {
                p.batchId = `FIX_${p.timestamp}_${p.content}`; 
              }

              if (!p.id || !uuidRegex.test(String(p.id))) {
                p.id = createUuid();
              }
            });
            // ------------------
            packages.value = data.packages;
          }
          if (data.goodsList) goodsList.value = data.goodsList;
          if (data.salesHistory) {
            data.salesHistory.forEach((order: any) => {
              if (!order.id || !uuidRegex.test(String(order.id))) {
                order.id = createUuid();
              }
            });
            salesHistory.value = data.salesHistory;
          }
          if (data.sellPrice) sellPrice.value = data.sellPrice;
          showToast('数据已恢复', 'success');
        }
      });
    } catch(err) {
      showToast('文件格式错误', 'error');
    }
  };
  reader.readAsText(file);
  target.value = ''; // Reset
};

const handleReset = () => {
  showDialog({
    title: '重置所有数据',
    content: '⚠️ 危险操作：这将清空本地所有数据（商品、订单等）。此操作不可撤销！',
    isDanger: true,
    action: async () => {
      try {
        await resetDatabase();
        localStorage.removeItem('last_sync_time');
        showToast('数据已清空', 'success');
        updateSyncTime();
      } catch (e) {
        showToast('重置失败', 'error');
      }
    }
  });
};

onMounted(() => {
  updateSyncTime();
});
</script>

<template>
  <div class="min-h-screen bg-surface text-primary pb-24 font-sans">
    <!-- Header -->
    <header class="pt-12 px-6 pb-6">
      <h1 class="text-3xl font-bold tracking-tight text-primary">设置</h1>
      <p class="text-gray-500 text-sm mt-1">管理数据同步与应用偏好</p>
    </header>

    <div class="px-4 space-y-6">
      
      <!-- Section: Cloud Sync -->
      <section>
        <h2 class="text-xs font-bold text-accent uppercase tracking-wider mb-3 px-2">云端同步</h2>
        <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          
          <!-- Status Row -->
          <div class="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
            <span class="text-gray-500">上次同步</span>
            <span class="font-mono text-primary">{{ lastSyncTime }}</span>
          </div>

          <!-- Action Buttons Area -->
          <div class="p-4 grid gap-3">
            <!-- Sync Button -->
            <button 
              @click="handleSync"
              :disabled="isSyncing"
              class="w-full bg-accent hover:bg-blue-500 active:scale-[0.98] transition-all text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm"
            >
              <i class="ph-bold ph-arrows-clockwise text-xl" :class="{'animate-spin': isSyncing}"></i>
              <span>{{ isSyncing ? '同步中...' : '立即同步' }}</span>
            </button>

            <!-- Backup Button -->
            <button 
              @click="handleBackup"
              :disabled="isBackingUp"
              class="w-full bg-gray-50 hover:bg-gray-100 active:scale-[0.98] transition-all text-primary py-3 px-4 rounded-xl flex items-center justify-between group"
            >
              <div class="text-left">
                <div class="font-medium flex items-center gap-2">
                  <i class="ph-bold ph-cloud-arrow-up text-lg"></i>
                  备份到云端
                </div>
                <div class="text-[10px] text-gray-400 mt-0.5 group-hover:text-gray-500 transition-colors">
                  将本地数据上传到云端
                </div>
              </div>
              <i class="ph-bold ph-caret-right text-gray-300" :class="{'animate-pulse': isBackingUp}"></i>
            </button>

            <!-- Recovery Button (Secondary) -->
            <button 
              @click="handleRecovery"
              :disabled="isRecovering"
              class="w-full bg-gray-50 hover:bg-gray-100 active:scale-[0.98] transition-all text-primary py-3 px-4 rounded-xl flex items-center justify-between group"
            >
              <div class="text-left">
                <div class="font-medium flex items-center gap-2">
                  <i class="ph-bold ph-cloud-arrow-down text-lg"></i>
                  从云端恢复数据
                </div>
                <div class="text-[10px] text-gray-400 mt-0.5 group-hover:text-gray-500 transition-colors">
                  用于找回误删的商品或订单
                </div>
              </div>
              <i class="ph-bold ph-caret-right text-gray-300" :class="{'animate-pulse': isRecovering}"></i>
            </button>
          </div>
        </div>
      </section>

      <!-- Section: Data Management -->
      <section>
        <h2 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">数据管理</h2>
        <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          
          <div class="divide-y divide-gray-50">
            <!-- Export -->
            <button 
              @click="handleExport"
              :disabled="isExporting"
              class="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <span class="text-primary">导出数据 (JSON)</span>
              <i class="ph-bold ph-export text-gray-300" :class="{'animate-pulse': isExporting}"></i>
            </button>
            
            <!-- Import -->
            <label class="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left cursor-pointer">
              <span class="text-primary">导入数据</span>
              <input type="file" accept=".json" class="hidden" @change="handleImport">
              <i class="ph-bold ph-download-simple text-gray-300"></i>
            </label>
          </div>
        </div>
      </section>

      <!-- Section: Danger Zone -->
      <section>
        <h2 class="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 px-2">危险区域</h2>
        <div class="bg-red-50 rounded-2xl border border-red-100 overflow-hidden shadow-sm">
          <button 
            @click="handleReset"
            class="w-full px-5 py-4 flex items-center justify-between hover:bg-red-100 transition-colors text-left group"
          >
            <div>
              <div class="text-red-500 font-medium group-hover:text-red-600">清空所有数据</div>
              <div class="text-[10px] text-red-400 mt-0.5">慎用：清空本地数据库</div>
            </div>
            <i class="ph-bold ph-trash text-red-400 group-hover:text-red-500 transition-colors"></i>
          </button>
        </div>
      </section>

      <!-- Footer Info -->
      <div class="text-center py-6">
        <div class="w-12 h-12 bg-accent rounded-xl mx-auto flex items-center justify-center mb-3 shadow-sm">
           <!-- Placeholder Logo -->
           <i class="ph-fill ph-package text-2xl text-white"></i>
        </div>
        <p class="text-gray-500 text-xs">GoodsMaster v{{ appVersion }}</p>
        <p class="text-gray-400 text-[10px] mt-1">Local-First Architecture</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Fallback styles in case Tailwind classes don't cover everything */
.text-accent {
  @apply text-blue-400;
}
.bg-accent {
  @apply bg-blue-600;
}
.bg-accent-hover {
  @apply bg-blue-500;
}
</style>
