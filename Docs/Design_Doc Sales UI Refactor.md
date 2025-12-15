# **Design Doc: Sales UI Refactor (开单收银台重构)**

Author: Gemini (AI Assistant)  
Status: Draft (Pending Coding)  
Last Updated: 2025-12-02  
Related Issues: QA-002 (Feature Gap), QA-003 (UI Consistency)

## **1\. Context (背景与现状)**

### **1.1 问题陈述**

目前的 SalesView.vue (开单页面) 沿用了 InventoryView 的设计，即简单的“垂直列表”布局。

* **体验痛点**：对于高频销售场景，列表查找效率低，缺乏商业软件（如 Shopify POS、秦丝）的专业感。  
* **视觉割裂**：开单页面的亮蓝色 (\#007AFF) 按钮与 Dashboard 页面的“深蓝/黑金 (Premium Dark)”风格不统一，导致 App 整体质感下降。

### **1.2 目标 (Goals)**

将开单页面重构为 **"Mobile POS (移动收银台)"** 模式，核心指标如下：

1. **高密度展示**：从 List (列表) 切换为 **Grid (网格)** 布局，单屏展示更多商品。  
2. **高效检索**：引入 **"分类导航 (Tabs)"**，支持按 \[全部 / 热销 / 最近 / 预警\] 快速筛选。  
3. **视觉统一**：采用 **"Obsidian & Gold" (黑曜石与金)** 配色方案，对齐 Dashboard 风格。  
4. **交互升级**：购物车改为底部悬浮抽LZ (Bottom Sheet)，增加操作反馈。

## **2\. UI/UX Design (设计规范)**

### **2.1 布局架构 (Layout Structure)**

采用经典的 **"Top Navigation \+ Grid Content \+ Bottom Cart"** 结构。

* **Header (顶部栏)**:  
  * 左侧：页面标题 "收银台"。  
  * 右侧：功能入口（如扫码开单、设置）。  
  * **下层 (Sub-Header)**: 横向滚动的 **Pill Tabs (胶囊分类)**。  
* **Body (内容区)**:  
  * **Grid Layout**: 双列 (2 columns) 商品卡片。  
  * **Card Design**: 白色卡片，微投影，圆角 20px。  
* **Footer (底部栏)**:  
  * **Floating Cart Bar (悬浮购物车条)**: 黑色半透明背景 \+ 模糊效果 (Backdrop Blur)。  
  * 展示：总件数、预估利润（小字）、总金额（大字）。

### **2.2 视觉主题 (Visual Theme \- "Premium Dark")**

* **Primary Color (主色)**: bg-slate-900 (接近黑色，用于重要按钮、购物车条)。  
* **Accent Color (强调色)**: text-amber-500 (金色，用于价格、利润显示)。  
* **Secondary** (次级): bg-slate-50 (背景底色)。  
* **Feedback**: 点击卡片时触发 active:scale-95 缩放动画，并伴随轻微震动 (Haptic Feedback)。

## **3\. Component Design (组件设计)**

### **3.1 分类导航 (Category Tabs)**

由于没有后端数据库支持复杂的分类表，我们采用**动态计算分类**：

* **全部 (All)**: 默认视图。  
* **🔥 热销 (Hot)**: 基于 salesHistory 统计销量 Top 10。  
* **⚠️ 预警 (Low Stock)**: 库存 \< 5 的商品。  
* **🕒 最近 (Recent)**: 最近一次进货的商品（方便处理刚到的货）。

### **3.2 商品卡片 (Product Card)**

每个 Grid Item 包含以下信息：

* **左上角**: 库存角标 (Badge)。如果是 \< 5 显示红色，否则显示灰色。  
* **中心**: 商品名称 (截断显示 2 行)。  
* **底部**:  
  * 售价 (大字体，如 ¥240)。  
  * 添加按钮 (+): 圆形黑色按钮，点击触发加入购物车动画。

### **3.3 购物车交互 (Cart Drawer)**

* **State 1: Collapsed (折叠态)**  
  * 位于底部 TabBar 上方。  
  * 显示 "去结算" 按钮和总金额。  
* **State 2: Expanded (展开态)**  
  * 上滑或点击展开为半屏 Modal。  
  * 列表展示已选商品。  
  * 支持：步进器修改数量、**直接输入框修改单价** (覆盖默认售价)。  
  * **关键改进**: 增加 Input Validation，价格/数量输入非法时弹出 Toast。

## **4\. Technical Implementation (技术实现)**

### **4.1 Data Logic (数据层)**

在 useStore.js 或 SalesView.vue 内部增加计算属性：

// 动态分类筛选逻辑  
const displayedProducts \= computed(() \=\> {  
  let list \= inventoryList.value; // 基础库存列表  
    
  switch (activeTab.value) {  
    case 'hot':  
      // 逻辑: 关联 salesHistory 统计频次  
      return getTopSellingProducts(list);  
    case 'low\_stock':  
      return list.filter(i \=\> i.quantity \< 5);  
    case 'recent':  
      // 逻辑: 关联 packages 进货时间  
      return getRecentlyAdded(list);  
    default:  
      return list;  
  }  
});

### **4.2 State Management (状态管理)**

需要新增的 UI 状态变量：

* activeTab: 当前选中的分类 (String, default: 'all').  
* isCartExpanded: 购物车详情是否展开 (Boolean).  
* searchQuery: 搜索关键词 (String).

### **4.3 Migration Steps (迁移步骤)**

1. **备份**: 保留当前的 SalesView.vue 代码。  
2. **样式引入**: 确认 tailwind.config.js 中是否有 slate-900 等颜色定义（已有 primary: '\#0F172A'，可复用）。  
3. **重构 HTML 结构**:  
   * 移除 \<ul\> 列表结构。  
   * 引入 \<div class="grid grid-cols-2 gap-3"\>。  
4. **替换配色**: 将所有 blue-500 替换为 primary (slate-900) 或 accent (amber-500)。

## **5\. Future Considerations (未来规划)**

* **自定义快捷键**: 对于非库存商品（如临时服务费），增加“无码开单”功能。  
* **多规格支持**: 目前烟草多为单规格，未来如果扩展到其他品类，Grid Card 点击需弹出规格选择器。