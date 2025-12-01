# **Code Review: 技术架构与代码复盘**

## **1\. 目录结构**

src/  
├── composables/  
│   └── useStore.js       \# 核心状态管理 (God Object)  
├── views/  
│   ├── InboxView.vue     \# 进货：列表、扫码、直入、批量录入  
│   ├── InventoryView.vue \# 库存：资产卡片、搜索  
│   ├── SalesView.vue     \# 销售：Grid布局、购物车、改价、历史侧边栏  
│   ├── DashboardView.vue \# 总览：Bento布局、图表、日期筛选、小票详情  
│   └── SettingsView.vue  \# 设置：数据导入导出  
├── components/           \# 通用组件 (Toast, Dialog)  
├── App.vue               \# 全局路由控制、全局弹窗挂载、底部导航  
└── style.css             \# Tailwind 自定义与动画

## **2\. 关键代码逻辑复盘**

### **2.1 状态管理 (useStore.js)**

* **单例模式**: 状态变量 (packages, salesHistory 等) 在 useStore 函数外部定义，保证多组件共享同一份响应式数据。  
* **持久化**: 使用 watch 深度监听所有核心变量，同步写入 localStorage。  
* **日期聚合**: 新增 selectedDate 和 dailyStats，所有 Dashboard 数据均基于 isSameDay 辅助函数进行过滤。  
* **图表数据**: chartData 动态计算过去 7 天的利润，返回 { labels, values, max } 用于 CSS 绘图。

### **2.2 销售模块 (SalesView.vue)**

* **布局重构**: 使用 Flexbox 实现 Left Sidebar (分类) \+ Right Grid (商品) 的自适应高度布局。  
* **交互优化**:  
  * **数量输入**: 购物车数量使用 \<input type="tel"\>，支持点击直接修改，失去焦点 (blur) 时自动校验。  
  * **改价**: 商品卡片价格区域绑定 @click.stop，调用 openGlobalPriceEdit 修改全局 sellPrice。  
  * **防遮挡**: 购物车抽屉使用 fixed inset-0 z-\[100\]，且底部 Padding 包含 pb-safe。  
* **编译修复**: 所有的 computed 回调均显式使用 function() {} 而非箭头函数，以避免特定的构建解析错误（如将 \> 误判为 JSX）。

### **2.3 总览模块 (DashboardView.vue)**

* **日期选择器**: 使用一个透明的 \<input type="date"\> 覆盖在显示的日期文本上，利用原生系统控件进行日期选择。  
* **图表渲染**: 不依赖第三方库，使用 Tailwind 的高度百分比 (:style="{height: ...}") 渲染轻量级柱状图。  
* **代码复用**: Dashboard 和 Sales 共享了“电子小票”详情页的逻辑，支持在任意位置查看订单详情、退单和修改备注。

### **2.4 进货模块 (InboxView.vue)**

* **误触修复**: 相册识别按钮的点击热区被严格限制，不再覆盖整个容器。  
* **直入模式**: isDirectEntry 变量控制 UI 切换。直入模式下，保存时生成的单号格式为 DIRECT\_{Timestamp}，且 verified 默认为 true。

## **3\. 已知限制与待办**

1. **OCR**: 目前相册识别仅为 Placeholder，未接入真实 OCR API。  
2. **性能**: 随着 salesHistory 增长，前端计算量会增大（目前未分页）。  
3. **构建**: 需保持对 JSX 语法的警惕，在 Vue \<script setup\> 中尽量使用标准 JS 语法。