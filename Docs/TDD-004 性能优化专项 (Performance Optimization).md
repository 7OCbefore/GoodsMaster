# **TDD-004: 性能优化专项 (Performance Optimization)**

| Metadata | Details |
| :---- | :---- |
| **Status** | Draft |
| **Author** | Performance Engineer |
| **Created** | 2025-12-15 |
| **Priority** | P1 (High) |

## **1\. 背景 (Context)**

在库存商品超过 1000 SKU 或销售记录超过 5000 条时，SalesView 和 DashboardView 出现明显的渲染延迟和滚动卡顿。

## **2\. 目标 (Goals)**

1. **FPS**: 复杂列表滚动保持 60fps。  
2. **Lighthouse**: Performance 评分 \> 95。  
3. **First Input Delay (FID)**: \< 100ms。

## **3\. 详细设计 (Detailed Design)**

### **3.1 虚拟滚动 (Virtualization)**

解决长列表 DOM 节点过多的问题。

* **库**: vue-virtual-scroller 或 @tanstack/vue-virtual.  
* **应用场景**:  
  * SalesView 商品网格：只渲染视口可见的 10-20 个商品卡片。  
  * InventoryView 列表：同上。  
  * DashboardView 历史订单流：同上。  
* **实现**: 需要固定列表项高度，或使用动态高度计算策略。

### **3.2 资源优化**

* **代码分割 (Code Splitting)**: 利用 Vite 的动态导入 (import())，将路由组件分包。  
  * const SalesView \= () \=\> import('./views/SalesView.vue')  
  * 将 xlsx 这样的大型库单独分包，或仅在点击“导出”按钮时才动态加载。  
* **SVG 优化**: 目前使用 vite-svg-loader 或内联 SVG。对于大量图标，建议使用 SVG Sprite 技术，减少 DOM 节点复杂度。

### **3.3 PWA 离线能力增强**

* **Service Worker**: 使用 vite-plugin-pwa。  
* **策略**: CacheFirst for assets, StaleWhileRevalidate for API (虽然目前无 API，但适用于静态资源更新)。  
* **安装引导**: 在 iOS Safari 上检测运行环境，提示用户“添加到主屏幕”。

### **3.4 渲染性能**

* **v-memo**: 在 Vue 3.2+ 中，对大量静态内容的列表项使用 v-memo，减少 Virtual DOM diff 开销。  
* **CSS 属性**: 确保动画仅触发布局重绘 (transform, opacity)，避免触发 layout 或 paint。使用 will-change 提示浏览器进行 GPU 加速。

## **4\. 验证指标**

使用 Chrome DevTools Performance 面板记录基准线（Baseline），并在优化后进行对比测试。