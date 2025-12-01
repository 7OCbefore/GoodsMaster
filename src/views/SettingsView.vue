<script setup>
import { inject } from 'vue';
import { useStore } from '../composables/useStore';

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
          if (data.packages) packages.value = data.packages;
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
</script>

<template>
  <div class="p-5 pt-safe space-y-8 bg-surface h-full">
    <header class="py-2">
      <h1 class="text-[32px] font-bold text-primary tracking-tight">设置</h1>
    </header>

    <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
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
      <div class="w-12 h-12 bg-primary rounded-2xl mx-auto mb-3 shadow-xl flex items-center justify-center text-white">
        <i class="ph-fill ph-package text-2xl"></i>
      </div>
      <p class="text-xs font-bold text-primary">GoodsMaster Pro</p>
      <p class="text-[10px] text-gray-400 font-mono">v2.0.0 (Premium Dark)</p>
    </div>
  </div>
</template>