<script setup>
import { ref, reactive, computed, nextTick } from 'vue';
import { useStore } from './composables/useStore';
import Toast from './components/Toast.vue';
import Dialog from './components/Dialog.vue';
import InboxView from './views/InboxView.vue';
import InventoryView from './views/InventoryView.vue';
import SalesView from './views/SalesView.vue';
import DashboardView from './views/DashboardView.vue';
import SettingsView from './views/SettingsView.vue';

// --- State ---
const { packages, goodsList, salesHistory, sellPrice, inventoryList, totalInventoryValue, totalInventoryCount, formatCurrency } = useStore();
const currentTab = ref('inbox');

// UI State
const toast = reactive({ show: false, msg: '', type: 'success' });
const dialog = reactive({ show: false, title: '', content: '', confirmText: '确定', action: null, isInput: false, inputValue: '', isDanger: false });
const isAddModalOpen = ref(false);
const isScanModalOpen = ref(false);
const isCartOpen = ref(false);
const isRecognizing = ref(false);
const batchList = ref([]);
const manualCode = ref('');
const globalForm = reactive({ content: '', quantity: '1', costPrice: '', note: '' });
const showSuggestions = ref(false);
const cart = ref([]);
const customerName = ref('');
const videoRef = ref(null);

// --- Methods (从 draft_v2.html 移植) ---
const showToast = (msg, type='success') => { toast.msg=msg; toast.type=type; toast.show=true; setTimeout(()=>toast.show=false, 2500); };
const confirmAction = (title, content, action, isDanger=false, confirmText='确定') => { dialog.title=title; dialog.content=content; dialog.action=action; dialog.isDanger=isDanger; dialog.confirmText=confirmText; dialog.isInput=false; dialog.show=true; };
const openSetPriceModal = (item, defaultPrice) => { dialog.title=`设置售价: ${item.name}`; dialog.content=`成本 ¥${formatCurrency(item.averageCost)}`; dialog.isInput=true; dialog.inputValue=defaultPrice; dialog.confirmText="保存"; dialog.action=()=>{ const p=parseFloat(dialog.inputValue); if(!p||p<=0)return showToast('无效','error'); sellPrice.value[item.name]=p; const c=cart.value.find(x=>x.name===item.name); if(c)c.sellPrice=p; showToast('售价已更新'); }; dialog.show=true; };

// 购物车逻辑
const cartTotal = computed(() => cart.value.reduce((s,i)=>s+i.sellPrice*i.quantity,0));
const cartItemCount = computed(() => cart.value.reduce((s,i)=>s+i.quantity,0));
const addToCart = (item) => {
  if(item.quantity<=0) return showToast('库存不足','warning');
  const existing = cart.value.find(c=>c.name===item.name);
  if(existing) { if(existing.quantity>=item.quantity)return showToast('库存上限','warning'); existing.quantity++; }
  else { let price = sellPrice.value[item.name]; if(!price){ price=Math.ceil(item.averageCost*1.2); openSetPriceModal(item, price); } cart.value.push({name:item.name, quantity:1, sellPrice:price||0, costSnapshot:item.averageCost}); }
  if(navigator.vibrate) navigator.vibrate(20);
};
const updateCartQuantity = (idx, qty) => {
  if(qty<=0) return cart.value.splice(idx,1);
  const item = cart.value[idx];
  const stock = inventoryList.value.find(i=>i.name===item.name);
  if(stock && qty>stock.quantity) return showToast('超出库存','warning');
  item.quantity = qty;
};
const checkout = () => {
  if(cart.value.length===0) return;
  const order = { id:Date.now(), timestamp:Date.now(), totalAmount:cartTotal.value, totalProfit:cart.value.reduce((s,i)=>s+((i.sellPrice-i.costSnapshot)*i.quantity),0), customer:customerName.value, items:JSON.parse(JSON.stringify(cart.value)) };
  salesHistory.value.unshift(order); cart.value=[]; customerName.value=''; isCartOpen.value=false; showToast('收款成功'); setTimeout(()=>currentTab.value='dashboard',400);
};

// 进货逻辑
const confirmBatchAdd = () => {
  if(!globalForm.content||batchList.value.length===0) return showToast('信息不全','warning');
  const qty=parseInt(globalForm.quantity)||1; const cost=parseFloat(globalForm.costPrice)||0; const batchId=Date.now().toString();
  if(!goodsList.value.includes(globalForm.content)) goodsList.value.unshift(globalForm.content);
  batchList.value.forEach(c => packages.value.unshift({id:Math.random()+Date.now(), batchId, tracking:c, content:globalForm.content, quantity:qty, costPrice:cost, note:globalForm.note, verified:false, timestamp:Date.now()}));
  showToast(`录入 ${batchList.value.length} 条`); batchList.value=[]; isAddModalOpen.value=false;
};
const addManualCode = () => {
  if(!manualCode.value) return;
  if(manualCode.value.length<4) return showToast('单号至少4位','warning');
  if(batchList.value.includes(manualCode.value)) return showToast('已存在','warning');
  batchList.value.push(manualCode.value); manualCode.value='';
};
const filterManualCode = (e) => manualCode.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const filterQuantity = (e) => globalForm.quantity = e.target.value.replace(/\D/g,'');
const filterPrice = (e) => globalForm.costPrice = e.target.value;
const handleImageRecognize = () => showToast('需 HTTPS 环境','warning');
const openScanModal = () => { if(!navigator.mediaDevices)return showToast('需 HTTPS','error'); isScanModalOpen.value=true; nextTick(()=>{ if(videoRef.value) initCamera(); }); };
const initCamera = async () => { try { const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); videoRef.value.srcObject=s; videoRef.value.play(); } catch(e){ showToast('无法访问摄像头','error'); } };
const closeScanModal = () => { isScanModalOpen.value=false; if(videoRef.value && videoRef.value.srcObject) { videoRef.value.srcObject.getTracks().forEach(t=>t.stop()); videoRef.value.srcObject=null; } };

// Helpers
const toggleVerify = (id) => { const p=packages.value.find(x=>x.id===id); p.verified=!p.verified; };
const confirmDelete = (id) => confirmAction('删除','确定删除？',()=>packages.value=packages.value.filter(p=>p.id!==id),true);
const openEditPrice = (pkg) => openSetPriceModal(pkg, pkg.costPrice);
const filteredGoodsSuggestions = computed(()=>goodsList.value.filter(g=>g.includes(globalForm.content)).slice(0,5));
const hideSuggestions = () => setTimeout(()=>showSuggestions.value=false,200);
const exportBackup = () => { const b=new Blob([JSON.stringify({packages:packages.value, goods:goodsList.value, sales:salesHistory.value})],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`Backup_${Date.now()}.json`; a.click(); showToast('已备份'); };
const importBackup = (e) => { const r=new FileReader(); r.onload=(ev)=>{ try{ const d=JSON.parse(ev.target.result); confirmAction('恢复','覆盖数据？',()=>{ if(d.packages)packages.value=d.packages; if(d.sales)salesHistory.value=d.sales; showToast('已恢复'); },true); }catch(e){showToast('文件错误','error');} }; if(e.target.files[0])r.readAsText(e.target.files[0]); };
const exportExcel = () => showToast('功能开发中');
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden relative">
    <Toast :show="toast.show" :msg="toast.msg" :type="toast.type" />
    <Dialog :show="dialog.show" v-bind="dialog" @close="dialog.show=false" @confirm="dialog.action && dialog.action()" @update:inputValue="val => dialog.inputValue = val" />

    <div class="flex-1 overflow-y-auto pt-safe pb-[90px] bg-slate-50">
      <InboxView v-if="currentTab === 'inbox'" @openScan="openScanModal" @openBatchAdd="isAddModalOpen=true" @toggleVerify="toggleVerify" @deleteItem="confirmDelete" @editPrice="openEditPrice" />
      <InventoryView v-if="currentTab === 'inventory'" />
      <SalesView v-if="currentTab === 'sales'" :cartItemCount="cartItemCount" :cartTotal="cartTotal" @addToCart="addToCart" @openCart="isCartOpen=true" @openSettings="currentTab='settings'" />
      <DashboardView v-if="currentTab === 'dashboard'" />
      <SettingsView v-if="currentTab === 'settings'" @exportBackup="exportBackup" @importBackup="importBackup" @exportExcel="exportExcel" />
    </div>

    <div class="fixed bottom-0 w-full glass-nav pb-safe z-[50]">
      <div class="flex justify-between h-[65px] px-6 items-center">
        <button v-for="tab in ['inbox','inventory','dashboard','sales','settings']" :key="tab" @click="currentTab=tab" :class="currentTab===tab?'text-primary':'text-slate-300'" class="flex-1 flex flex-col items-center gap-1 active:scale-95 transition-transform">
          <i :class="currentTab===tab ? (tab==='inbox'?'ph-fill ph-tray': tab==='inventory'?'ph-fill ph-package': tab==='dashboard'?'ph-fill ph-chart-pie-slice': tab==='sales'?'ph-fill ph-storefront':'ph-fill ph-gear') : (tab==='inbox'?'ph-bold ph-tray': tab==='inventory'?'ph-bold ph-package': tab==='dashboard'?'ph-bold ph-chart-pie-slice': tab==='sales'?'ph-bold ph-storefront':'ph-bold ph-gear')" class="text-2xl"></i>
          <span class="text-[10px] font-bold capitalize">{{ tab }}</span>
        </button>
      </div>
    </div>

    <!-- Modals (移植过来) -->
    <!-- 1. 批量录入 -->
    <transition name="slide-up">
      <div v-if="isAddModalOpen" class="fixed inset-0 z-[100] bg-slate-50 flex flex-col">
        <div class="bg-white px-5 py-4 flex justify-between items-center shadow-sm pt-safe shrink-0 border-b border-slate-100">
          <button @click="isAddModalOpen=false" class="text-slate-400 font-bold text-[15px]">取消</button>
          <h2 class="font-extrabold text-[17px] text-primary">批量录入</h2>
          <button @click="confirmBatchAdd" class="text-primary font-bold text-[15px]" :class="batchList.length===0?'opacity-30':'opacity-100'">保存({{batchList.length}})</button>
        </div>
        <div class="flex-1 overflow-y-auto p-5 pb-10">
          <div class="flex gap-3 mb-6">
            <label class="flex-1 bg-white rounded-2xl h-28 flex flex-col items-center justify-center border border-slate-100 shadow-sm active:scale-95 transition-all relative"><input type="file" accept="image/*" class="hidden" @change="handleImageRecognize"><span v-if="isRecognizing" class="animate-spin text-2xl text-primary"><i class="ph-bold ph-spinner"></i></span><div v-else class="text-center text-primary"><i class="ph-bold ph-camera text-3xl mb-1"></i><div class="text-[12px] font-bold">相册识别</div></div></label>
            <div class="flex-1 bg-white rounded-2xl h-28 p-3 shadow-sm border border-slate-100 flex flex-col justify-between"><input v-model="manualCode" @input="filterManualCode" type="text" placeholder="后4位" maxlength="30" class="w-full text-center text-[24px] font-mono font-bold bg-transparent outline-none placeholder-slate-200 text-primary"><button @click="addManualCode" class="w-full bg-primary text-white text-[12px] font-bold py-2 rounded-xl active:scale-95 transition-transform">添加</button></div>
          </div>
          <div v-if="batchList.length>0" class="bg-white rounded-2xl p-2 shadow-sm mb-6 max-h-40 overflow-y-auto border border-slate-100"><div v-for="(item,i) in batchList" class="flex justify-between items-center p-3 border-b border-slate-50 last:border-0"><span class="font-mono font-bold text-primary text-[15px]">{{item}}</span><button @click="batchList.splice(i,1)" class="text-slate-300 active:text-red-500"><i class="ph-bold ph-x text-lg"></i></button></div></div>
          <div class="bg-white rounded-2xl p-5 shadow-sm space-y-4 border border-slate-100"><div><label class="text-[11px] font-bold text-slate-400 uppercase ml-1">货物名称</label><input v-model="globalForm.content" @focus="showSuggestions=true" @blur="hideSuggestions" class="w-full mt-1 bg-slate-50 p-3.5 rounded-xl font-bold text-primary outline-none focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all"><div v-if="showSuggestions&&filteredGoodsSuggestions.length" class="mt-2 bg-white shadow-xl rounded-xl absolute z-10 w-64 border border-slate-100 p-1"><div v-for="g in filteredGoodsSuggestions" @click="globalForm.content=g" class="p-2.5 hover:bg-slate-50 rounded-lg text-sm font-bold text-primary">{{g}}</div></div></div><div class="flex gap-4"><div class="flex-1"><label class="text-[11px] font-bold text-slate-400 uppercase ml-1">数量</label><input v-model="globalForm.quantity" @input="filterQuantity" type="tel" class="w-full mt-1 bg-slate-50 p-3.5 rounded-xl font-bold text-center outline-none"></div><div class="flex-[1.5]"><label class="text-[11px] font-bold text-slate-400 uppercase ml-1">进货单价</label><div class="relative mt-1"><span class="absolute left-3.5 top-3.5 text-slate-400 font-bold">¥</span><input v-model="globalForm.costPrice" @input="filterPrice" type="tel" class="w-full bg-slate-50 p-3.5 pl-8 rounded-xl font-bold outline-none"></div></div></div></div>
        </div>
      </div>
    </transition>

    <!-- 2. 扫码 -->
    <transition name="fade"><div v-if="isScanModalOpen" class="fixed inset-0 z-[200] bg-black flex flex-col"><div class="absolute top-0 w-full p-4 pt-safe flex justify-between items-center z-20"><div class="text-white/90 text-xs font-bold bg-white/20 px-3 py-1 rounded-full backdrop-blur">扫描中...</div><button @click="closeScanModal" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white backdrop-blur"><i class="ph-bold ph-x text-xl"></i></button></div><div class="flex-1 relative"><video ref="videoRef" class="w-full h-full object-cover opacity-60"></video><div class="absolute inset-0 flex items-center justify-center"><div class="w-64 h-48 border-2 border-white/30 rounded-3xl relative"><div class="absolute inset-0 border-2 border-transparent border-t-accent border-r-accent w-full h-full rounded-3xl clip-path-corner"></div><div class="absolute top-1/2 left-4 right-4 h-0.5 bg-accent scan-line shadow-[0_0_15px_#F59E0B]"></div></div></div></div></div></transition>

    <!-- 3. 购物车 -->
    <transition name="slide-up">
      <div v-if="isCartOpen" class="fixed inset-0 z-[150] flex flex-col justify-end">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="isCartOpen=false"></div>
        <div class="bg-white w-full rounded-t-[32px] p-6 pb-safe relative z-10 max-h-[85vh] flex flex-col shadow-2xl">
          <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 shrink-0"></div>
          <div class="flex justify-between items-center mb-6 shrink-0"><h2 class="text-[22px] font-extrabold text-primary">购物车</h2><button @click="cart=[]" class="text-red-500 text-sm font-bold flex items-center gap-1 bg-red-50 px-3 py-1 rounded-full"><i class="ph-bold ph-trash"></i> 清空</button></div>
          <div class="mb-4 space-y-3 shrink-0"><input v-model="customerName" type="text" placeholder="客户姓名 (选填)" class="w-full bg-slate-50 px-4 py-3.5 rounded-2xl text-[15px] font-bold outline-none"></div>
          <div class="flex-1 overflow-y-auto space-y-3 mb-6 pr-1"><div v-for="(item, i) in cart" :key="i" class="flex justify-between items-center bg-white border border-slate-50 p-3 rounded-2xl"><div class="flex-1"><div class="font-bold text-[16px] text-primary mb-0.5">{{item.name}}</div><div class="text-xs text-slate-400 font-medium">售价 ¥{{item.sellPrice}} · 利润 <span class="text-accent">¥{{((item.sellPrice-item.costSnapshot)*item.quantity).toFixed(0)}}</span></div></div><div class="flex items-center gap-3 bg-slate-50 rounded-xl p-1 border border-slate-100"><button @click="updateCartQuantity(i, item.quantity-1)" class="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary font-bold">-</button><span class="font-bold text-[15px] w-6 text-center text-primary">{{item.quantity}}</span><button @click="updateCartQuantity(i, item.quantity+1)" class="w-8 h-8 rounded-lg bg-primary text-white shadow-sm flex items-center justify-center font-bold">+</button></div></div></div>
          <div class="border-t border-slate-50 pt-4 shrink-0"><div class="flex justify-between items-end mb-4"><span class="text-slate-400 font-bold text-sm">合计金额</span><span class="text-[36px] font-bold text-primary leading-none tracking-tight">¥{{formatCurrency(cartTotal)}}</span></div><button @click="checkout" class="w-full bg-primary text-white font-bold text-[17px] py-4 rounded-[20px] shadow-xl shadow-primary/20 active:scale-[0.98] transition-transform flex justify-center items-center gap-2"><i class="ph-bold ph-check-circle text-xl"></i> 确认收款</button></div>
        </div>
      </div>
    </transition>
  </div>
</template>