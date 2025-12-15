<script setup>
import { inject } from 'vue';
import { useStore } from '../composables/useStore';
import { syncService } from '../services/syncService';
import { supabase } from '../services/supabase';

const { packages, goodsList, salesHistory, sellPrice } = useStore();
const showToast = inject('showToast');
const showDialog = inject('showDialog');

const exportBackup = () => {
  const data = JSON.stringify({
    packages: packages.value,
    goodsList: goodsList.value,
    salesHistory: salesHistory.value,
    sellPrice: sellPrice.value,
    version: '2.0'
  });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GoodsMaster_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('备份已下载');
};

const handleImport = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
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
            // --- 数据清洗逻辑 ---
            data.packages.forEach(p => {
              // 如果没有 batchId，尝试生成一个
              if (!p.batchId) {
                // 策略：使用 "FIX_" + 时间戳 + 商品名 作为批次号
                // 这样同一时间(毫秒级)录入的同名商品会被归为一批
                // 如果你的旧数据时间戳并不完全一致，可以只取到分钟级，例如: Math.floor(p.timestamp / 60000)
                p.batchId = `FIX_${p.timestamp}_${p.content}`; 
              }
            });
            // ------------------
            packages.value = data.packages;
          }
          if (data.goodsList) goodsList.value = data.goodsList;
          if (data.salesHistory) salesHistory.value = data.salesHistory;
          if (data.sellPrice) sellPrice.value = data.sellPrice;
          showToast('数据已恢复');
        }
      });
    } catch(err) {
      showToast('文件格式错误', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset
};

// 云同步功能
const syncWithCloud = async () => {
  try {
    showToast('正在同步云端数据...', 'info');
    await syncService.sync();
    showToast('云端同步成功');
  } catch (error) {
    console.error('云端同步失败:', error);
    showToast('云端同步失败: ' + error.message, 'error');
  }
};

const backupToCloud = async () => {
  try {
    const user = supabase ? await supabase.auth.getUser() : null;
    if (!user?.data.user) {
      showToast('请先登录以使用云同步功能', 'error');
      return;
    }

    showToast('正在备份数据到云端...', 'info');
    await syncService.backupToCloud();
    showToast('数据已备份到云端');
  } catch (error) {
    console.error('云端备份失败:', error);
    showToast('云端备份失败: ' + error.message, 'error');
  }
};

// 检查用户是否已登录
const isUserLoggedIn = async () => {
  if (!supabase) return false;
  const user = await supabase.auth.getUser();
  return !!user.data.user;
};

// 获取用户信息
const getUserInfo = async () => {
  if (!supabase) return null;
  const user = await supabase.auth.getUser();
  return user.data.user;
};
</script>

<template>
  <div class="p-5 pt-safe space-y-8 bg-surface h-full">
    <header class="py-2">
      <h1 class="text-[32px] font-bold text-primary tracking-tight">设置</h1>
    </header>

    <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
      <!-- Cloud Sync Section -->
      <div @click="syncWithCloud" class="p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50 transition-colors cursor-pointer">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <i class="ph-bold ph-cloud-arrow-down text-xl"></i>
          </div>
          <div>
            <div class="font-bold text-primary text-sm">同步云端数据</div>
            <div class="text-[10px] text-gray-400">从云端获取最新数据</div>
          </div>
        </div>
        <i class="ph-bold ph-caret-right text-gray-300"></i>
      </div>

      <div @click="backupToCloud" class="p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50 transition-colors cursor-pointer">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <i class="ph-bold ph-cloud-arrow-up text-xl"></i>
          </div>
          <div>
            <div class="font-bold text-primary text-sm">备份到云端</div>
            <div class="text-[10px] text-gray-400">将本地数据上传到云端</div>
          </div>
        </div>
        <i class="ph-bold ph-caret-right text-gray-300"></i>
      </div>

      <!-- Backup -->
      <div @click="exportBackup" class="p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50 transition-colors cursor-pointer">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <i class="ph-bold ph-download-simple text-xl"></i>
          </div>
          <div>
            <div class="font-bold text-primary text-sm">备份数据</div>
            <div class="text-[10px] text-gray-400">导出 JSON 文件</div>
          </div>
        </div>
        <i class="ph-bold ph-caret-right text-gray-300"></i>
      </div>

      <!-- Restore -->
      <label class="p-5 flex items-center justify-between active:bg-gray-50 transition-colors cursor-pointer">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
            <i class="ph-bold ph-upload-simple text-xl"></i>
          </div>
          <div>
            <div class="font-bold text-primary text-sm">恢复数据</div>
            <div class="text-[10px] text-gray-400">导入 JSON 文件</div>
          </div>
        </div>
        <input type="file" accept=".json" class="hidden" @change="handleImport">
        <i class="ph-bold ph-caret-right text-gray-300"></i>
      </label>
    </div>

    <div class="text-center space-y-1">
      <div class="w-12 h-12 bg-[#0A84FF] rounded-2xl mx-auto mb-3 shadow-xl flex items-center justify-center text-white">
        <i class="ph-fill ph-package text-2xl"></i>
      </div>
      <p class="text-xs font-bold text-primary">GoodsMaster Pro</p>
      <p class="text-[10px] text-gray-400 font-mono">v2.0.0 (Premium Dark)</p>
    </div>
  </div>
</template>