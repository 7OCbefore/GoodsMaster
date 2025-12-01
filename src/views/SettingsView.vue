<script setup>
import { useStore } from '../composables/useStore';
const emit = defineEmits(['exportBackup', 'importBackup', 'exportExcel']);
</script>
<template>
  <div class="p-5 space-y-6">
    <header class="py-2"><h1 class="text-[32px] font-extrabold text-primary tracking-tight">系统设置</h1></header>
    <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
      <div @click="emit('exportBackup')" class="p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50 transition-colors cursor-pointer"><div class="flex items-center gap-4"><div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><i class="ph-bold ph-download-simple text-xl"></i></div><span class="font-bold text-primary">备份数据 (JSON)</span></div><i class="ph-bold ph-caret-right text-gray-300"></i></div>
      <label class="p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50 transition-colors cursor-pointer"><div class="flex items-center gap-4"><div class="w-10 h-10 rounded-full bg-amber-50 text-accent flex items-center justify-center"><i class="ph-bold ph-upload-simple text-xl"></i></div><span class="font-bold text-primary">恢复数据</span></div><input type="file" accept=".json" class="hidden" @change="e => emit('importBackup', e)"><i class="ph-bold ph-caret-right text-gray-300"></i></label>
      <div @click="emit('exportExcel')" class="p-5 flex items-center justify-between active:bg-gray-50 transition-colors cursor-pointer"><div class="flex items-center gap-4"><div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><i class="ph-bold ph-file-csv text-xl"></i></div><span class="font-bold text-primary">导出 Excel</span></div><i class="ph-bold ph-caret-right text-gray-300"></i></div>
    </div>
    <div class="text-center"><p class="text-xs font-bold text-slate-300">GoodsMaster Pro v1.3</p></div>
  </div>
</template>