<script setup>
import { ref, computed, inject } from 'vue';
import { useStore } from '../composables/useStore';

const { 
  inventoryList, 
  sellPrice, 
  formatCurrency, 
  salesHistory, 
  refundOrder, 
  updateOrderNote,
  packages // 需要访问packages来添加临时库存
} = useStore();

const showToast = inject('showToast');
const showDialog = inject('showDialog');

const currentCategory = ref('all'); 
const searchQuery = ref('');
const isCartOpen = ref(false);
const isHistoryOpen = ref(false); 
const cart = ref([]);
const customerName = ref('');

// 筛选按钮配置
const categories = [
  { key: 'all', label: '全部', icon: 'ph-squares-four' },
  { key: 'hot', label: '热销', icon: 'ph-fire' },
  { key: 'low', label: '低库存', icon: 'ph-warning' }
];

// --- 计算逻辑 ---
const availableItems = computed(() => inventoryList.value.filter(i => i.quantity > 0));

const displayList = computed(() => {
  let list = availableItems.value;
  if (searchQuery.value) {
    list = list.filter(i => i.name.includes(searchQuery.value));
  }
  if (currentCategory.value === 'hot') {
    const salesMap = {};
    salesHistory.value.forEach(s => {
      if(s.status !== 'refunded') s.items.forEach(i => salesMap[i.name] = (salesMap[i.name]||0) + i.quantity);
    });
    list = [...list].sort((a,b) => (salesMap[b.name]||0) - (salesMap[a.name]||0));
  } else if (currentCategory.value === 'low') {
    list = list.filter(i => i.quantity < 5);
  }
  return list;
});

const cartTotal = computed(() => cart.value.reduce((s, i) => s + (i.sellPrice * i.quantity), 0));
const cartCount = computed(() => cart.value.reduce((s, i) => s + i.quantity, 0));

// 计算超卖商品数量
const driftItemsCount = computed(() => {
  return cart.value.filter(i => i.quantity > i.maxStock).length;
});

// --- 销售操作 ---
function addToCart(item) {
  const existing = cart.value.find(c => c.name === item.name);
  if (existing) {
    existing.quantity++;
    // 更新最大库存值
    existing.maxStock = item.quantity;
  } else {
    let price = sellPrice.value[item.name];
    if (!price) {
        price = Math.ceil(item.averageCost * 1.1);
        showToast(`未定价，按成本1.1倍预填`, 'warning');
    }
    
    cart.value.push({
      name: item.name,
      quantity: 1,
      sellPrice: price,
      costSnapshot: item.averageCost,
      maxStock: item.quantity
    });
  }
  if (navigator.vibrate) navigator.vibrate(10);
}

function updateCartQty(idx, delta) {
  const item = cart.value[idx];
  const newQty = parseInt(item.quantity) + delta;
  if (newQty <= 0) cart.value.splice(idx, 1);
  else {
      item.quantity = newQty;
  }
}

// 添加一个新的函数来处理手动输入数量的情况
function handleQuantityChange(idx) {
  const item = cart.value[idx];
  const newQty = parseInt(item.quantity);
  
  // 如果输入的不是一个有效数字，重置为1
  if (isNaN(newQty) || newQty <= 0) {
    item.quantity = 1;
    return;
  }
}

// 执行JIT库存修正
async function performJITCorrection(item, requiredQuantity) {
  // 查找最近一次进货记录获取成本价
  const lastPurchase = packages.value
    .filter(p => p.content === item.name && p.verified)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  
  const costPrice = lastPurchase ? lastPurchase.costPrice : item.averageCost;
  
  // 计算需要补充的库存数量（只需要补充差额）
  const shortage = requiredQuantity - item.quantity;
  
  // 创建一个临时的进货记录
  const tempPackage = {
    id: Math.random() + Date.now(),
    batchId: `jit_${Date.now()}`,
    tracking: `JIT_ADJUST_${Date.now()}`,
    content: item.name,
    quantity: shortage, // 只补充差额数量
    costPrice: costPrice,
    note: 'JIT库存修正',
    verified: true, // 直接标记为已入库
    timestamp: Date.now()
  };
  
  packages.value.unshift(tempPackage);
  
  // 返回Promise以便调用者知道操作完成
  return new Promise(resolve => {
    // 短暂延迟后resolve（等待inventoryList更新）
    setTimeout(() => {
      const updatedItem = inventoryList.value.find(i => i.name === item.name);
      if (updatedItem) {
        resolve({ success: true, updatedItem });
      } else {
        resolve({ success: false });
      }
    }, 100);
  });
}

// 修改checkout函数，添加库存漂移检查和处理
async function checkout() {
  if (cart.value.length === 0) return;
  
  // 检查是否有超卖商品
  const driftItems = cart.value.filter(i => i.quantity > i.maxStock);
  
  // 如果有超卖商品，显示汇总修正弹窗
  if (driftItems.length > 0) {
    // 构建详细信息（使用纯文本格式，避免HTML标签）
    let content = '检测到以下商品库存不足，将执行自动修正并入库：\n\n';
    driftItems.forEach(item => {
      const shortage = item.quantity - item.maxStock;
      content += `• ${item.name}：需 ${item.quantity}，存 ${item.maxStock}（补 +${shortage}）\n`;
    });
    
    showDialog({
      title: '库存自动修正',
      content,
      confirmText: '一键修正并开单',
      cancelText: '取消',
      action: async () => {
        // 用户确认后，执行所有修正
        for (const item of driftItems) {
          const cartItem = cart.value.find(i => i.name === item.name);
          if (cartItem) {
            const inventoryItem = inventoryList.value.find(i => i.name === item.name);
            if (inventoryItem) {
              await performJITCorrection(inventoryItem, cartItem.quantity);
            }
          }
        }
        
        // 所有修正完成后执行开单
        completeCheckout();
      }
    });
  } else {
    // 没有超卖商品，直接开单
    completeCheckout();
  }
}

// 实际执行开单操作
function completeCheckout() {
  const order = {
    id: Date.now(),
    timestamp: Date.now(),
    customer: customerName.value,
    totalAmount: cartTotal.value,
    totalProfit: cart.value.reduce((s, i) => s + ((i.sellPrice - i.costSnapshot) * i.quantity), 0),
    items: JSON.parse(JSON.stringify(cart.value)),
    status: 'completed',
    note: ''
  };
  salesHistory.value.unshift(order);
  showToast('开单成功', 'success');
  cart.value = [];
  customerName.value = '';
  isCartOpen.value = false;
}

// 复制文本到剪贴板
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('货物清单已复制到剪贴板', 'success');
  }).catch(err => {
    console.error('复制失败:', err);
    showToast('复制失败，请手动复制', 'error');
  });
}

// 复制购物车为纯文本（隐藏利润信息）
function exportCartToText() {
  if (cart.value.length === 0) {
    showToast('购物车为空，无法复制', 'warning');
    return;
  }

  let text = '';
  
  // 添加客户姓名（如果有的话）
  if (customerName.value) {
    text += `${customerName.value}\n\n`;
  }

  // 商品列表 - 使用新的格式
  cart.value.forEach((item, index) => {
    const name = item.name;
    const quantity = item.quantity;
    const price = formatCurrency(item.sellPrice);
    const subtotal = formatCurrency(item.sellPrice * item.quantity);
    
    // 使用"单价 乘以 数量 = 小计"的表述方式
    text += `${index + 1}. ${name}\n`;
    text += `   ¥${price} 乘以 ${quantity} = ¥${subtotal}\n\n`;
  });

  // 总计
  text += `总计：¥${formatCurrency(cartTotal.value)}\n`;

  // 复制到剪贴板
  copyToClipboard(text);
}

function openGlobalPriceEdit(item) {
    showDialog({
        title: `设置 "${item.name}" 售价`,
        content: `成本 ¥${formatCurrency(item.averageCost)}`,
        isInput: true,
        inputValue: sellPrice.value[item.name] || '',
        confirmText: '保存',
        action: (val) => {
            const p = parseFloat(val);
            if (p > 0) {
                sellPrice.value[item.name] = p;
                showToast('售价已更新');
            }
        }
    });
}

function editCartItemPrice(cartItem, index) {
    showDialog({
        title: `修改 "${cartItem.name}" 售价`,
        content: `成本 ¥${formatCurrency(cartItem.costSnapshot)}`,
        isInput: true,
        inputValue: cartItem.sellPrice,
        confirmText: '保存',
        action: (val) => {
            const p = parseFloat(val);
            if (p > 0) {
                cart.value[index].sellPrice = p;
                showToast('售价已更新');
            }
        }
    });
}

// --- 订单详情逻辑 (与 Dashboard 复用) ---
const isDetailOpen = ref(false);
const currentOrder = ref(null);

const viewOrder = (order) => {
    currentOrder.value = order;
    isDetailOpen.value = true;
};

const handleRefund = () => {
    if (!currentOrder.value) return;
    showDialog({
        title: '确认退单',
        content: '库存将自动恢复。',
        isDanger: true,
        action: () => {
            refundOrder(currentOrder.value.id);
            showToast('已退单');
            isDetailOpen.value = false;
        }
    });
};

const handleEditNote = () => {
    if (!currentOrder.value) return;
    showDialog({
        title: '备注',
        isInput: true,
        inputValue: currentOrder.value.note || '',
        action: (val) => {
            updateOrderNote(currentOrder.value.id, val);
            showToast('备注已保存');
        }
    });
};
</script>

<template>
  <div class="flex flex-col h-full bg-surface pt-safe">
    <!-- Header -->
    <div class="px-4 py-2 bg-surface z-10 flex gap-3 items-center">
      <div class="bg-white rounded-xl flex items-center px-3 py-2.5 shadow-sm flex-1">
        <i class="ph ph-magnifying-glass text-gray-400 text-lg mr-2"></i>
        <input v-model="searchQuery" placeholder="搜索商品..." class="flex-1 bg-transparent outline-none text-sm font-bold text-primary placeholder-gray-300">
      </div>
      <button @click="isHistoryOpen = true" class="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm active:scale-95 transition-transform">
        <i class="ph-bold ph-clock-counter-clockwise text-xl"></i>
      </button>
    </div>

    <!-- Main Grid -->
    <div class="flex flex-1 overflow-hidden pb-[80px]">
      <!-- Left Sidebar -->
      <div class="w-20 flex flex-col items-center py-4 gap-4 bg-white border-r border-gray-100">
        <button 
          v-for="cat in categories" 
          :key="cat.key" 
          @click="currentCategory=cat.key" 
          :class="currentCategory===cat.key ? 'bg-[#0A84FF] text-white shadow-lg' : 'text-gray-400 bg-gray-50'" 
          class="w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
        >
          <i :class="cat.icon" class="ph-bold text-xl"></i>
          <span class="text-[9px] font-bold">{{ cat.label }}</span>
        </button>
      </div>

      <!-- Right Grid -->
      <div class="flex-1 overflow-y-auto p-4 bg-white rounded-tl-[32px] shadow-inner hide-scrollbar">
        <!-- 修改点：将 grid-cols-3 改为 grid-cols-2 -->
        <div class="grid grid-cols-2 gap-3">
          <div v-for="item in displayList" :key="item.name" class="bg-surface p-3 rounded-2xl relative transition-transform border border-transparent active:border-primary/10 group h-32 flex flex-col justify-between">
            <div class="absolute top-2 right-2 bg-white px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-400 shadow-sm pointer-events-none">{{ item.quantity }}</div>
            <div @click="addToCart(item)" class="flex-1 cursor-pointer">
                <div class="font-bold text-sm text-primary leading-tight line-clamp-2 mt-1">{{ item.name }}</div>
            </div>
            <div class="flex justify-between items-end">
              <div @click.stop="openGlobalPriceEdit(item)" class="group/price cursor-pointer px-1 -ml-1 rounded hover:bg-gray-200/50 transition-colors">
                <div class="text-[10px] text-gray-400 flex items-center gap-1">售价 <i class="ph-bold ph-pencil-simple text-[8px] opacity-0 group-hover/price:opacity-100"></i></div>
                <div class="text-sm font-extrabold text-primary">
                    <span v-if="sellPrice[item.name]">¥{{ sellPrice[item.name] }}</span>
                    <span v-else class="text-orange-500 text-xs">未定价</span>
                </div>
              </div>
              <div @click="addToCart(item)" class="w-7 h-7 bg-[#0A84FF] text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 transition-transform cursor-pointer">
                <i class="ph-bold ph-plus"></i>
              </div>
            </div>
          </div>
        </div>
        <div v-if="displayList.length === 0" class="h-full flex flex-col items-center justify-center opacity-40">
          <i class="ph ph-shopping-cart text-4xl mb-2"></i>
          <span class="text-xs font-bold">暂无商品</span>
        </div>
      </div>
    </div>

    <!-- Cart Bar -->
    <div v-if="cartCount > 0" class="fixed bottom-[90px] left-4 right-4 z-30 animate-pop">
      <div class="bg-[#0A84FF] text-white rounded-[24px] p-2 pl-5 pr-2 shadow-2xl shadow-blue-500/40 flex items-center justify-between border border-white/10 backdrop-blur-md">
        <div @click="isCartOpen = true" class="flex flex-col cursor-pointer">
          <span class="text-[10px] text-white/60 font-bold uppercase tracking-wider">共 {{ cartCount }} 件</span>
          <span class="text-xl font-bold">¥{{ formatCurrency(cartTotal) }}</span>
        </div>
        <button @click="isCartOpen = true" class="bg-white text-[#0A84FF] px-6 py-3 rounded-[20px] font-bold text-sm active:scale-95 transition-transform flex items-center gap-1">
          去结算 <i class="ph-bold ph-arrow-right"></i>
        </button>
      </div>
    </div>

    <!-- Cart Drawer -->
    <Transition name="fade">
      <div v-if="isCartOpen" class="fixed inset-0 z-[100] flex flex-col justify-end">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="isCartOpen=false"></div>
        <div class="bg-surface w-full rounded-t-[32px] p-6 pb-safe relative z-10 max-h-[90vh] flex flex-col shadow-2xl animate-fade-in">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6 shrink-0"></div>
          <div class="flex justify-between items-center mb-6 shrink-0">
            <h2 class="text-2xl font-bold text-primary">购物车</h2>
            <button @click="cart=[]" class="text-danger text-sm font-bold bg-danger/10 px-3 py-1 rounded-full"><i class="ph-bold ph-trash"></i> 清空</button>
          </div>
          
          <!-- 购物车顶部状态栏 -->
          <div v-if="driftItemsCount > 0" class="mb-4 p-3 rounded-xl bg-orange-50 flex items-center">
            <i class="ph-fill ph-warning text-orange-500 text-lg mr-2"></i>
            <div class="text-orange-800 text-sm font-bold">
              {{ driftItemsCount }} 款商品超出库存，将于结算时自动修正
            </div>
          </div>
          
          <div class="flex-1 overflow-y-auto space-y-3 mb-6 pr-1 hide-scrollbar">
            <div v-for="(item, i) in cart" :key="i" class="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm"
                 :class="{ 'border border-danger border-2': item.quantity > item.maxStock }">
              <div class="flex-1 mr-3">
                <div class="font-bold text-primary truncate">{{ item.name }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <div @click="editCartItemPrice(item, i)" class="text-xs font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1">
                    ¥{{ item.sellPrice }}
                    <i class="ph-bold ph-pencil-simple text-[8px]"></i>
                  </div>
                  <span class="text-[10px] text-gray-400">利润 ¥{{ ((item.sellPrice - item.costSnapshot)*item.quantity).toFixed(1) }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 bg-surface rounded-xl p-1 shadow-inner">
                <button @click="updateCartQty(i, -1)" class="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-primary font-bold">-</button>
                <input 
                  type="tel" 
                  v-model="item.quantity" 
                  @blur="handleQuantityChange(i)"
                  class="w-10 bg-transparent text-center font-bold text-sm outline-none p-0 appearance-none"
                  :class="{ 'text-danger font-extrabold': item.quantity > item.maxStock }">
                <button @click="updateCartQty(i, 1)" class="w-8 h-8 bg-[#0A84FF] text-white rounded-lg shadow-sm flex items-center justify-center font-bold">+</button>
              </div>
            </div>
          </div>
          <div class="border-t border-gray-200 pt-4 shrink-0 space-y-4 pb-safe mb-2">
             <input v-model="customerName" placeholder="客户姓名 (选填)" class="w-full bg-white p-3.5 rounded-2xl font-bold outline-none text-sm text-center shadow-sm focus:ring-2 focus:ring-primary/10 transition-all">

             <!-- 导出/复制按钮 -->
             <button @click="exportCartToText" class="w-full bg-gray-100 text-primary font-bold text-lg py-4 rounded-[24px] shadow-sm active:scale-[0.98] transition-transform flex justify-center items-center gap-2">
               <i class="ph-bold ph-clipboard-text text-2xl"></i>
               <span>复制货物清单</span>
             </button>

             <button @click="checkout" class="w-full bg-[#0A84FF] text-white font-bold text-lg py-4 rounded-[24px] shadow-xl active:scale-[0.98] transition-transform flex justify-center items-center gap-2">
               <i class="ph-bold ph-check-circle text-2xl"></i>
               <span>开单 ¥{{ formatCurrency(cartTotal) }}</span>
             </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- History Drawer -->
    <Transition name="fade">
      <div v-if="isHistoryOpen" class="fixed inset-0 z-[100] flex flex-col justify-end">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="isHistoryOpen=false"></div>
        <div class="bg-surface w-full h-[95vh] rounded-t-[32px] p-0 pb-safe relative z-10 flex flex-col shadow-2xl animate-fade-in overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
            <h2 class="text-xl font-bold text-primary">销售记录</h2>
            <button @click="isHistoryOpen=false" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><i class="ph-bold ph-x text-lg"></i></button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
             <div v-if="salesHistory.length === 0" class="text-center text-gray-400 py-10 text-sm">暂无记录</div>
             <div v-for="order in salesHistory" :key="order.id" @click="viewOrder(order)" class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden active:scale-[0.99] transition-transform">
                <div v-if="order.status==='refunded'" class="absolute inset-0 bg-gray-100/50 z-10 flex items-center justify-center pointer-events-none">
                    <span class="text-2xl font-bold text-gray-300 -rotate-12 border-4 border-gray-300 px-3 py-1 rounded-xl">已退单</span>
                </div>
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-bold text-lg text-primary">¥{{ formatCurrency(order.totalAmount) }}</div>
                        <div class="text-[10px] text-gray-500 font-medium">{{ new Date(order.timestamp).toLocaleString() }}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs font-bold text-success">+¥{{ formatCurrency(order.totalProfit) }}</div>
                        <div class="text-[10px] text-gray-400 mt-0.5">{{ order.customer || '散客' }} · {{ order.items.length }}种商品</div>
                    </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Detail Drawer (Reusable) -->
    <Transition name="fade">
      <div v-if="isDetailOpen" class="fixed inset-0 z-[110] flex flex-col justify-end">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="isDetailOpen=false"></div>
        <div class="bg-surface w-full h-[85vh] rounded-t-[32px] relative z-10 flex flex-col shadow-2xl animate-fade-in overflow-hidden">
          <div class="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
            <h2 class="text-lg font-bold text-primary">订单详情</h2>
            <button @click="isDetailOpen=false" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><i class="ph-bold ph-x text-lg"></i></button>
          </div>
          <div v-if="currentOrder" class="flex-1 overflow-y-auto p-5 bg-gray-50">
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div v-if="currentOrder.status === 'refunded'" class="absolute right-4 top-4 border-2 border-gray-300 text-gray-300 font-bold px-2 py-1 rounded rotate-12 text-sm">已退款</div>
              <div class="flex justify-between items-start mb-6">
                <div><div class="text-xs text-gray-400 mb-1">客户</div><div class="font-bold text-primary text-lg">{{ currentOrder.customer || '散客' }}</div></div>
                <div class="text-right"><div class="text-xs text-gray-400 mb-1">时间</div><div class="text-sm font-bold text-gray-600">{{ new Date(currentOrder.timestamp).toLocaleString() }}</div></div>
              </div>
              <div class="space-y-3 mb-6 border-t border-dashed border-gray-200 pt-4">
                <div v-for="item in currentOrder.items" :key="item.name" class="flex justify-between items-center text-sm">
                  <div><div class="font-bold text-primary">{{ item.name }}</div><div class="text-[10px] text-gray-400 mt-0.5">成本 ¥{{ formatCurrency(item.costSnapshot) }} × {{ item.quantity }}</div></div>
                  <div class="text-right"><div class="font-bold">¥{{ formatCurrency(item.sellPrice * item.quantity) }}</div><div class="text-[10px] text-success font-medium">赚 ¥{{ formatCurrency((item.sellPrice - item.costSnapshot) * item.quantity) }}</div></div>
                </div>
              </div>
              <div class="border-t border-gray-100 pt-4 space-y-2">
                <div class="flex justify-between text-sm"><span class="text-gray-500">总计金额</span><span class="font-bold text-primary">¥{{ formatCurrency(currentOrder.totalAmount) }}</span></div>
                <div class="flex justify-between text-sm"><span class="text-gray-500">总毛利</span><span class="font-bold text-success">+¥{{ formatCurrency(currentOrder.totalProfit) }}</span></div>
              </div>
              <div v-if="currentOrder.note" class="mt-4 bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-xs text-yellow-700"><span class="font-bold">备注：</span> {{ currentOrder.note }}</div>
            </div>
          </div>
          <div v-if="currentOrder && currentOrder.status !== 'refunded'" class="bg-white p-4 border-t border-gray-100 pb-safe grid grid-cols-2 gap-3 shrink-0">
            <button @click="handleEditNote" class="py-3.5 rounded-xl font-bold text-primary bg-gray-100">修改备注</button>
            <button @click="handleRefund" class="py-3.5 rounded-xl font-bold text-danger bg-danger/10">退单</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>