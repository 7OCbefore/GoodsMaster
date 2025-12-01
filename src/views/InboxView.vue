<script setup>
import { ref, reactive, computed, inject, nextTick, watch } from 'vue';
import { useStore } from '../composables/useStore';

const { packages, goodsList } = useStore();
const showToast = inject('showToast');
const showDialog = inject('showDialog');

const filter = ref('pending');
const searchQuery = ref('');

// --- 列表逻辑 ---
const filteredList = computed(() => {
  let list = packages.value.filter(p => filter.value === 'pending' ? !p.verified : p.verified);
  if (searchQuery.value) {
    const q = searchQuery.value.toUpperCase();
    list = list.filter(p => p.tracking.includes(q) || p.content.includes(q));
  }
  return list.sort((a,b) => b.timestamp - a.timestamp);
});

const pendingCount = computed(() => packages.value.filter(p => !p.verified).length);

// --- 操作逻辑 ---
const toggleVerify = (pkg) => {
  if (pkg.verified) {
    showDialog({
      title: '撤销入库',
      content: '确定要撤销这条记录的入库状态吗？',
      isDanger: true,
      action: () => { pkg.verified = false; showToast('已撤销', 'warning'); }
    });
  } else {
    pkg.verified = true;
    showToast('已入库');
  }
};

const deleteItem = (id) => {
  showDialog({
    title: '删除记录',
    content: '此操作不可恢复，确定删除？',
    isDanger: true,
    action: () => {
      const idx = packages.value.findIndex(p => p.id === id);
      if (idx > -1) packages.value.splice(idx, 1);
      showToast('已删除');
    }
  });
};

const editPrice = (pkg) => {
  showDialog({
    title: '修改进价',
    isInput: true,
    inputValue: pkg.costPrice > 0 ? pkg.costPrice : '',
    action: (val) => {
      const price = parseFloat(val);
      if (isNaN(price) || price < 0) return showToast('价格无效', 'warning');
      pkg.costPrice = price;
      showToast('价格已更新');
    }
  });
};

// --- 批量录入 Modal ---
const isAddModalOpen = ref(false);
const batchList = ref([]);
const manualCode = ref('');
const form = reactive({ content: '', quantity: '1', costPrice: '', note: '' });
const isDirectEntry = ref(false); // 直入模式开关
const showSuggestions = ref(false);

const addManualCode = () => {
  if (manualCode.value.length < 4) return showToast('单号至少4位', 'warning');
  if (batchList.value.includes(manualCode.value)) return showToast('单号已存在', 'warning');
  batchList.value.push(manualCode.value);
  manualCode.value = '';
};

// 切换直入模式
watch(isDirectEntry, (val) => {
  if (val) {
    batchList.value = []; // 清空扫码列表
    manualCode.value = '';
  }
});

// 价格记忆
watch(() => form.content, (val) => {
  if (!val) return;
  const last = packages.value.find(p => p.content === val && p.costPrice > 0);
  if (last) form.costPrice = last.costPrice;
});

const confirmBatchAdd = () => {
  if (!form.content) return showToast('请填写货名', 'warning');
  
  // 直入模式：不需要单号列表
  if (!isDirectEntry.value && batchList.value.length === 0) return showToast('请录入单号', 'warning');

  const batchId = Date.now().toString();
  if (!goodsList.value.includes(form.content)) goodsList.value.unshift(form.content);

  // 构造列表：直入模式生成1个，普通模式根据单号生成
  const codesToProcess = isDirectEntry.value ? [`DIRECT_${Date.now().toString().slice(-6)}`] : batchList.value;

  codesToProcess.forEach(code => {
    packages.value.unshift({
      id: Math.random() + Date.now(),
      batchId,
      tracking: code,
      content: form.content,
      quantity: parseInt(form.quantity) || 1,
      costPrice: parseFloat(form.costPrice) || 0,
      note: form.note,
      verified: isDirectEntry.value, // 直入模式直接已核验
      timestamp: Date.now()
    });
  });
  
  showToast(`成功录入 ${codesToProcess.length} 条`);
  // Reset
  batchList.value = [];
  form.content = ''; form.quantity = '1'; form.costPrice = ''; isDirectEntry.value = false;
  isAddModalOpen.value = false;
};

// --- 扫码逻辑 ---
const isScanOpen = ref(false);
const videoRef = ref(null);
const scanResult = ref(null);
let scanStream = null;

const startScan = async () => {
  if (!navigator.mediaDevices || !window.BarcodeDetector) return showToast('设备不支持扫码', 'error');
  isScanOpen.value = true;
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    await nextTick();
    videoRef.value.srcObject = scanStream;
    videoRef.value.play();
    detectLoop();
  } catch (e) {
    showToast('摄像头启动失败', 'error');
    isScanOpen.value = false;
  }
};

const detectLoop = async () => {
  if (!isScanOpen.value) return;
  try {
    const detector = new BarcodeDetector();
    const codes = await detector.detect(videoRef.value);
    if (codes.length > 0) handleScanned(codes[0].rawValue);
  } catch (e) {}
  requestAnimationFrame(detectLoop);
};

const handleScanned = (code) => {
  if (scanResult.value) return; 
  const c = code.toUpperCase();
  const target = packages.value.find(p => !p.verified && (p.tracking === c || c.endsWith(p.tracking)));
  
  if (target) {
    target.verified = true;
    scanResult.value = { type: 'success', msg: `已核验: ${target.content}` };
    if (navigator.vibrate) navigator.vibrate(100);
    setTimeout(() => scanResult.value = null, 1500);
  } else {
    scanResult.value = { type: 'error', msg: '未找到该包裹' };
    if (navigator.vibrate) navigator.vibrate(300);
    setTimeout(() => scanResult.value = null, 1500);
  }
};

const stopScan = () => {
  isScanOpen.value = false;
  if (scanStream) scanStream.getTracks().forEach(t => t.stop());
};
</script>

<template>
  <div class="flex flex-col h-full bg-surface">
    <!-- Header: 修复遮挡和层级 -->
    <header class="px-5 py-4 flex justify-between items-end bg-surface/90 backdrop-blur sticky top-0 z-50 border-b border-gray-100 pt-safe">
      <h1 class="text-[28px] font-bold text-primary tracking-tight">进货管理</h1>
      <div class="flex bg-gray-200/50 p-1 rounded-lg">
        <button @click="filter='pending'" :class="filter==='pending'?'bg-white shadow text-primary':'text-gray-500'" class="px-3 py-1.5 text-xs font-bold rounded-md transition-all">待收 {{pendingCount}}</button>
        <button @click="filter='verified'" :class="filter==='verified'?'bg-white shadow text-primary':'text-gray-500'" class="px-3 py-1.5 text-xs font-bold rounded-md transition-all">已收</button>
      </div>
    </header>

    <!-- Search -->
    <div class="px-5 py-2 z-40 bg-surface">
      <div class="bg-white rounded-xl flex items-center px-3 py-2.5 shadow-sm border border-gray-50">
        <i class="ph ph-magnifying-glass text-gray-400 text-lg mr-2"></i>
        <input v-model="searchQuery" placeholder="搜索单号或货名" class="flex-1 bg-transparent outline-none text-sm font-bold placeholder-gray-300 text-primary">
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto px-5 space-y-3 pb-24 hide-scrollbar">
      <div v-if="filteredList.length === 0" class="flex flex-col items-center py-20 opacity-40">
        <i class="ph ph-package text-4xl mb-2"></i>
        <span class="text-sm font-bold">暂无数据</span>
      </div>

      <div v-for="item in filteredList" :key="item.id" class="bg-white p-4 rounded-2xl shadow-sm active:scale-[0.99] transition-transform border border-gray-50 relative overflow-hidden">
        <!-- 装饰：直入标记 -->
        <div v-if="item.tracking.startsWith('DIRECT_')" class="absolute top-0 right-0 bg-green-100 text-green-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg">直入</div>

        <div class="flex justify-between items-start mb-2">
          <div class="font-bold text-lg text-primary">{{ item.content }}</div>
          <span class="bg-secondary/10 text-secondary px-2 py-0.5 rounded text-xs font-bold">x{{ item.quantity }}</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <span class="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{{ item.tracking.startsWith('DIRECT_') ? '无单号' : item.tracking }}</span>
          <button @click.stop="editPrice(item)" class="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors" :class="item.costPrice > 0 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-500 animate-pulse'">
            <i class="ph-bold ph-tag"></i>
            <span class="font-bold">{{ item.costPrice > 0 ? `¥${item.costPrice}` : '补填进价' }}</span>
          </button>
        </div>
        <div class="flex gap-3 pt-3 border-t border-gray-50">
          <button @click.stop="toggleVerify(item)" class="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors" :class="item.verified ? 'bg-gray-100 text-gray-500' : 'bg-primary text-white shadow-lg shadow-primary/20'">
            <i :class="item.verified ? 'ph-bold ph-arrow-u-up-left' : 'ph-bold ph-check'"></i>
            {{ item.verified ? '撤销' : '确认收货' }}
          </button>
          <button @click.stop="deleteItem(item.id)" class="w-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 active:text-red-500">
            <i class="ph-bold ph-trash text-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- FABs -->
    <div class="fixed bottom-24 right-5 flex flex-col gap-4 z-40">
      <button @click="startScan" class="w-14 h-14 bg-white rounded-full shadow-xl border border-gray-100 flex items-center justify-center text-primary active:scale-90 transition-transform">
        <i class="ph-bold ph-scan text-2xl"></i>
      </button>
      <button @click="isAddModalOpen = true" class="w-14 h-14 bg-primary rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center text-white active:scale-90 transition-transform">
        <i class="ph-bold ph-plus text-2xl"></i>
      </button>
    </div>

    <!-- Batch Add Modal -->
    <Transition name="fade">
      <div v-if="isAddModalOpen" class="fixed inset-0 z-[100] bg-surface flex flex-col">
        <div class="px-4 py-3 bg-white shadow-sm flex justify-between items-center pt-safe shrink-0">
          <button @click="isAddModalOpen=false" class="text-gray-400 font-bold">取消</button>
          <span class="font-bold text-lg">录入货物</span>
          <button @click="confirmBatchAdd" class="text-accent font-bold">保存</button>
        </div>
        
        <div class="p-5 flex-1 overflow-y-auto">
          <!-- 模式切换: 普通 vs 直入 -->
          <div class="bg-white rounded-2xl p-4 shadow-sm mb-6 flex items-center justify-between border border-gray-50">
            <div>
                <div class="font-bold text-primary">直入库存模式</div>
                <div class="text-[10px] text-gray-400">非快递渠道，无需单号，直接入库</div>
            </div>
            <div @click="isDirectEntry = !isDirectEntry" class="w-12 h-7 rounded-full transition-colors relative" :class="isDirectEntry ? 'bg-success' : 'bg-gray-200'">
                <div class="w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-transform" :class="isDirectEntry ? 'left-6' : 'left-1'"></div>
            </div>
          </div>

          <!-- 单号录入区域 (仅普通模式显示) -->
          <div v-if="!isDirectEntry" class="transition-all">
              <div class="flex gap-3 mb-4">
                 <!-- 修复：将 label 替换为 div，并明确点击区域 -->
                 <div class="flex-1 bg-white h-28 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-accent relative overflow-hidden group">
                   <input type="file" accept="image/*" class="absolute inset-0 opacity-0 z-10 cursor-pointer" @change="(e) => showToast('暂未集成OCR', 'warning')">
                   <i class="ph-bold ph-camera text-3xl mb-1 group-active:scale-90 transition-transform"></i>
                   <span class="text-xs font-bold">相册识别</span>
                 </div>
                 
                 <div class="flex-1 bg-white h-28 rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col justify-between">
                   <input v-model="manualCode" placeholder="输入后4位" class="text-center font-mono font-bold text-xl outline-none placeholder-gray-200 text-primary uppercase w-full bg-transparent" maxlength="10">
                   <button @click="addManualCode" class="bg-primary text-white text-xs font-bold py-2 rounded-lg active:opacity-80">添加单号</button>
                 </div>
              </div>
              <!-- List -->
              <div v-if="batchList.length" class="mb-6 bg-white rounded-2xl p-2 shadow-sm max-h-32 overflow-y-auto">
                <div v-for="(code, i) in batchList" :key="i" class="flex justify-between p-3 border-b border-gray-50 last:border-0">
                  <span class="font-mono font-bold">{{code}}</span>
                  <button @click="batchList.splice(i,1)" class="text-gray-300"><i class="ph-bold ph-x"></i></button>
                </div>
              </div>
          </div>

          <!-- Form -->
          <div class="bg-white rounded-2xl p-4 shadow-sm space-y-4 border border-gray-50">
            <div>
              <label class="text-xs font-bold text-gray-400 uppercase ml-1">货名</label>
              <input v-model="form.content" placeholder="例如：黄鹤楼" class="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary">
            </div>
            <div class="flex gap-4">
              <div class="flex-1">
                <label class="text-xs font-bold text-gray-400 uppercase ml-1">数量</label>
                <input v-model="form.quantity" type="tel" class="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold text-center outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary">
              </div>
              <div class="flex-1">
                <label class="text-xs font-bold text-gray-400 uppercase ml-1">单价</label>
                <input v-model="form.costPrice" type="tel" placeholder="0.00" class="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold text-center outline-none text--600 focus:ring-2 focus:ring-orange-100 transition-all">
              </div>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-400 uppercase ml-1">备注</label>
              <input v-model="form.note" placeholder="可选..." class="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold outline-none text-sm text-primary">
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Scan Overlay -->
    <Transition name="fade">
      <div v-if="isScanOpen" class="fixed inset-0 z-[100] bg-black flex flex-col">
        <div class="pt-safe px-4 py-4 flex justify-between items-center z-10">
          <div class="bg-black/40 backdrop-blur px-3 py-1 rounded-full text-white text-xs font-bold border border-white/10">待收: {{pendingCount}}</div>
          <button @click="stopScan" class="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white"><i class="ph-bold ph-x text-xl"></i></button>
        </div>
        <div class="flex-1 relative">
          <video ref="videoRef" class="w-full h-full object-cover opacity-80"></video>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-64 h-48 border-2 border-white/30 rounded-3xl relative overflow-hidden shadow-[0_0_0_100vh_rgba(0,0,0,0.5)]">
               <div class="absolute inset-x-0 h-0.5 bg-accent top-0 scan-line shadow-[0_0_20px_#0A84FF]"></div>
            </div>
          </div>
          <div v-if="scanResult" class="absolute bottom-20 left-0 w-full flex justify-center">
            <div class="px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2" :class="scanResult.type==='success'?'bg-success text-white':'bg-danger text-white'">
              <i :class="scanResult.type==='success'?'ph-bold ph-check':'ph-bold ph-warning'"></i>
              {{ scanResult.msg }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>