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

// --- 改价逻辑 (含批量同步) ---
const editPrice = (pkg) => {
  showDialog({
    title: '修改进价',
    content: `货物：${pkg.content}`,
    isInput: true,
    inputValue: pkg.costPrice > 0 ? pkg.costPrice : '',
    action: (val) => {
      const price = parseFloat(val);
      if (isNaN(price) || price < 0) return showToast('价格无效', 'warning');
      
      // 检查是否有同批次同名商品
      const siblings = packages.value.filter(p => 
        p.batchId === pkg.batchId && 
        p.content === pkg.content && 
        p.id !== pkg.id
      );

      if (siblings.length > 0) {
        // 延迟触发二次弹窗，避免冲突
        setTimeout(() => {
          showDialog({
            title: '批量同步',
            content: `检测到同批次还有 ${siblings.length} 个"${pkg.content}"，是否同步修改价格？`,
            confirmText: '同步修改',
            action: () => {
              siblings.forEach(p => p.costPrice = price);
              pkg.costPrice = price;
              showToast(`已同步 ${siblings.length + 1} 条记录`);
            }
          });
        }, 300);
      } else {
        pkg.costPrice = price;
        showToast('价格已更新');
      }
    }
  });
};

// --- 批量录入 Modal ---
const isAddModalOpen = ref(false);
const batchList = ref([]);
const manualCode = ref('');
const form = reactive({ content: '', quantity: '1', costPrice: '', note: '' });
const showSuggestions = ref(false);
const isDirectMode = ref(false); // 直入模式开关

const addManualCode = () => {
  if (manualCode.value.length < 4) return showToast('单号至少4位', 'warning');
  if (batchList.value.includes(manualCode.value)) return showToast('单号已存在', 'warning');
  batchList.value.push(manualCode.value);
  manualCode.value = '';
};

// 添加处理相册图片选择的方法
const handleImageSelect = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // 显示加载提示
  showToast('正在识别条形码...', 'info');
  
  try {
    // 检查浏览器是否支持 BarcodeDetector API
    if (!window.BarcodeDetector) {
      showToast('当前浏览器不支持条形码识别', 'warning');
      return;
    }

    // 创建 BarcodeDetector 实例
    const barcodeDetector = new BarcodeDetector();
    
    // 从文件创建图像对象
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = async () => {
      try {
        // 检测条形码
        const barcodes = await barcodeDetector.detect(img);
        
        if (barcodes.length > 0) {
          // 取第一个识别到的条形码
          const code = barcodes[0].rawValue;
          
          // 检查是否已存在
          if (batchList.value.includes(code)) {
            showToast('单号已存在', 'warning');
          } else {
            batchList.value.push(code);
            showToast(`识别成功: ${code}`, 'success');
          }
        } else {
          // 没有识别到条形码，保持原行为
          showToast('暂未集成OCR', 'warning');
        }
        
        // 清理对象URL
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        console.error('条形码识别错误:', err);
        showToast('识别失败，请重试', 'error');
        URL.revokeObjectURL(objectUrl);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showToast('图片加载失败', 'error');
    };
    
    img.src = objectUrl;
  } catch (err) {
    console.error('处理图片时发生错误:', err);
    showToast('处理图片时发生错误', 'error');
  }
};

// 生成直入模式单号
const generateDirectCode = () => {
  return `DIRECT_${Date.now()}`;
};

// 直入模式：自动添加一条记录
const addDirectEntry = () => {
  const code = generateDirectCode();
  if (batchList.value.includes(code)) return showToast('单号已存在', 'warning');
  batchList.value.push(code);
};

// 价格记忆
watch(() => form.content, (val) => {
  if (!val) return;
  const last = packages.value.find(p => p.content === val && p.costPrice > 0);
  if (last) form.costPrice = last.costPrice;
});

const confirmBatchAdd = () => {
  if (!form.content) return showToast('请填写货名', 'warning');
  
  // 直入模式：如果没有单号则自动生成
  if (isDirectMode.value && batchList.value.length === 0) {
    addDirectEntry();
  }
  
  if (batchList.value.length === 0) return showToast('请添加至少一个单号', 'warning');
  
  const batchId = Date.now().toString();
  if (!goodsList.value.includes(form.content)) goodsList.value.unshift(form.content);

  batchList.value.forEach(code => {
    packages.value.unshift({
      id: Math.random() + Date.now(),
      batchId,
      tracking: code,
      content: form.content,
      quantity: parseInt(form.quantity) || 1,
      costPrice: parseFloat(form.costPrice) || 0,
      note: form.note,
      verified: isDirectMode.value ? true : false, // 直入模式自动标记为已入库
      timestamp: Date.now()
    });
  });
  
  showToast(`成功录入 ${batchList.value.length} 条${isDirectMode.value ? '（已自动入库）' : ''}`);
  batchList.value = [];
  form.content = ''; form.quantity = '1'; form.costPrice = ''; form.note = '';
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
  if (scanResult.value) return; // 防止重复
  const c = code.toUpperCase();
  // 模糊匹配
  const target = packages.value.find(p => !p.verified && (p.tracking === c || c.endsWith(p.tracking)));
  
  if (target) {
    target.verified = true;
    scanResult.value = { 
      type: 'success', 
      msg: `${target.content} x${target.quantity} (${target.tracking}) 已入库` 
    };
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
  <div class="flex flex-col h-full bg-surface pt-safe pb-[80px]">
    <!-- Header -->
    <header class="px-5 py-4 flex justify-between items-end bg-surface sticky top-0 z-10">
      <h1 class="text-[32px] font-bold text-primary tracking-tight">进货管理</h1>
      <div class="flex bg-gray-200/50 p-1 rounded-lg">
        <button @click="filter='pending'" :class="filter==='pending'?'bg-white shadow text-primary':'text-gray-500'" class="px-3 py-1 text-xs font-bold rounded-md transition-all">待收 {{pendingCount}}</button>
        <button @click="filter='verified'" :class="filter==='verified'?'bg-white shadow text-primary':'text-gray-500'" class="px-3 py-1 text-xs font-bold rounded-md transition-all">已收</button>
      </div>
    </header>

    <!-- Search -->
    <div class="px-5 mb-4">
      <div class="bg-white rounded-xl flex items-center px-3 py-2.5 shadow-sm">
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

      <div v-for="item in filteredList" :key="item.id" class="bg-white p-4 rounded-2xl shadow-sm active:scale-[0.98] transition-transform border border-gray-50">
        <div class="flex justify-between items-start mb-2">
          <div class="font-bold text-lg text-primary">{{ item.content }}</div>
          <span class="bg-secondary/10 text-secondary px-2 py-0.5 rounded text-xs font-bold">x{{ item.quantity }}</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <span class="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{{ item.tracking }}</span>
          <button @click.stop="editPrice(item)" class="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors" :class="item.costPrice > 0 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-500 animate-pulse'">
            <i class="ph-bold ph-tag"></i>
            <span class="font-bold">{{ item.costPrice > 0 ? `¥${item.costPrice}` : '补填进价' }}</span>
          </button>
        </div>
        <div class="flex gap-3 pt-3 border-t border-gray-50">
          <button @click.stop="toggleVerify(item)" class="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors" :class="item.verified ? 'bg-gray-100 text-gray-500' : 'bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30'">
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
      <button @click="isAddModalOpen = true" class="w-14 h-14 bg-[#0A84FF] rounded-full shadow-2xl shadow-blue-500/40 flex items-center justify-center text-white active:scale-90 transition-transform">
        <i class="ph-bold ph-plus text-2xl"></i>
      </button>
    </div>

    <!-- Batch Add Modal -->
    <Transition name="fade">
      <div v-if="isAddModalOpen" class="fixed inset-0 z-50 bg-surface flex flex-col justify-center">
        <div class="bg-white shadow-sm pt-safe">
          <div class="px-6 py-4 flex justify-between items-center">
            <button @click="isAddModalOpen=false" class="text-gray-400 font-bold min-h-[28px] flex items-center">取消</button>
            <span class="font-bold text-lg">批量录入</span>
            <button @click="confirmBatchAdd" :class="(batchList.length || (isDirectMode && form.content)) ? 'text-accent' : 'text-gray-300'" class="font-bold min-h-[28px] flex items-center">保存 ({{batchList.length}})</button>
          </div>
        </div>
        <div class="p-5 flex-1 overflow-y-auto">
          <!-- 直入模式开关 -->
          <div class="mb-4 bg-[#0A84FF] rounded-2xl p-4 border border-blue-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <i class="ph-bold ph-lightning text-xl text-white"></i>
                <div>
                  <div class="font-bold text-white">直入模式</div>
                  <div class="text-xs text-white/70 mt-0.5">自动生成单号并直接入库</div>
                </div>
              </div>
              <button @click="isDirectMode = !isDirectMode" class="relative w-12 h-7 rounded-full transition-colors" :class="isDirectMode ? 'bg-white' : 'bg-white/30'">
                <div class="absolute top-1 w-5 h-5 rounded-full shadow-md transition-transform" :class="isDirectMode ? 'left-6 bg-[#0A84FF]' : 'left-1 bg-white'"></div>
              </button>
            </div>
          </div>
          
          <!-- Codes Input -->
          <div v-if="!isDirectMode" class="flex gap-3 mb-6">
             <div class="flex-1 bg-white h-28 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-accent active:bg-blue-50 transition-colors relative">
               <i class="ph-bold ph-camera text-3xl mb-1"></i>
               <span class="text-xs font-bold">相册识别</span>
               <input type="file" accept="image/*" class="absolute inset-0 opacity-0" @change="handleImageSelect">
             </div>
             <div class="flex-1 bg-white h-28 rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col justify-between">
               <input v-model="manualCode" placeholder="输入后4位" class="text-center font-mono font-bold text-xl outline-none placeholder-gray-200 text-primary uppercase" maxlength="10">
               <button @click="addManualCode" class="bg-[#0A84FF] text-white text-xs font-bold py-2 rounded-lg">手动添加</button>
             </div>
          </div>
          
          <!-- 直入模式提示 -->
          <div v-else class="mb-6 bg-white rounded-2xl p-6 shadow-sm border border-dashed border-gray-200">
            <div class="text-center">
              <i class="ph-bold ph-check-circle text-4xl text-success mb-2"></i>
              <div class="font-bold text-primary mb-1">直入模式已开启</div>
              <div class="text-xs text-gray-500">填写货物信息后将自动生成单号并入库</div>
            </div>
          </div>
          
          <!-- List -->
          <div v-if="batchList.length" class="mb-6 bg-white rounded-2xl p-2 shadow-sm max-h-32 overflow-y-auto">
            <div v-for="(code, i) in batchList" :key="i" class="flex justify-between p-3 border-b border-gray-50 last:border-0">
              <span class="font-mono font-bold">{{code}}</span>
              <button @click="batchList.splice(i,1)" class="text-gray-300"><i class="ph-bold ph-x"></i></button>
            </div>
          </div>
          <!-- Form -->
          <div class="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div>
              <label class="text-xs font-bold text-gray-400 uppercase ml-1">货名</label>
              <input v-model="form.content" placeholder="例如：黄鹤楼" class="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold outline-none focus:ring-2 focus:ring-accent/20">
              <!-- Suggestions can go here -->
            </div>
            <div class="flex gap-4">
              <div class="flex-1">
                <label class="text-xs font-bold text-gray-400 uppercase ml-1">数量</label>
                <input v-model="form.quantity" type="tel" class="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold text-center outline-none">
              </div>
              <div class="flex-1">
                <label class="text-xs font-bold text-gray-400 uppercase ml-1">单价</label>
                <input v-model="form.costPrice" type="tel" placeholder="0.00" class="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold text-center outline-none text-orange-600">
              </div>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-400 uppercase ml-1">备注</label>
              <input v-model="form.note" class="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold outline-none text-sm">
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Scan Overlay -->
    <Transition name="fade">
      <div v-if="isScanOpen" class="fixed inset-0 z-[60] bg-black flex flex-col">
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
          <!-- Scan Result Toast -->
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