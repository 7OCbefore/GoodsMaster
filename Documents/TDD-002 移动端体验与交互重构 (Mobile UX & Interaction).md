# **TDD-002: 移动端体验与交互重构 (Mobile UX & Interaction)**

| Metadata | Details |
| :---- | :---- |
| **Status** | Draft |
| **Author** | UX Engineer |
| **Created** | 2025-12-15 |
| **Priority** | P2 (Enhancement) |

## **1\. 背景 (Context)**

应用目前使用简单的组件切换模拟导航，缺乏原生 App 的流畅感。交互反馈较弱，且部分操作（如数字输入）依赖系统键盘，体验不够“沉浸”。

## **2\. 目标 (Goals)**

打造媲美 iOS 原生应用的用户体验 (Human Interface Guidelines 对齐)。

## **3\. 详细设计 (Detailed Design)**

### **3.1 路由与转场 (Router & Transitions)**

引入 vue-router 接管页面导航。

* **架构**:  
  * 一级导航（底栏 Tab）：Dashboard, Inbox, Inventory, Sales, Settings。  
  * 二级页面（如订单详情、商品详情）：覆盖在一级导航之上。  
* **动画 (Transitions)**:  
  * **Tab 切换**: Fade (淡入淡出) 或 无动画。  
  * **进入二级页**: Slide Left (右侧滑入，且带有视差效果)。  
  * **返回**: Slide Right (左侧滑出)。  
  * **模态弹窗**: Spring Up (底部弹簧滑入)。

### **3.2 手势操作 (Gestures)**

引入 @use-gesture/vue 实现自然的手势交互。

* **列表项**:  
  * **左滑**: 显示“删除”或“退单”红色按钮。  
  * **右滑**: 显示“标记/编辑”蓝色按钮。  
* **返回操作**: 支持屏幕左边缘右滑返回 (Edge Swipe Back)。  
* **下拉刷新**: 在 Dashboard 和 Inventory 实现 iOS 风格的弹性下拉刷新。

### **3.3 自定义数字键盘 (Custom Number Pad)**

在 SalesView 开单场景中，系统软键盘会遮挡 UI，且切换中英文输入法繁琐。

* **方案**: 实现一个应用内纯数字键盘组件 (VirtualNumPad.vue)。  
* **布局**: 3x4 网格，包含 0-9、.、删除、确认。  
* **音效与触感**:  
  * 按键绑定 navigator.vibrate(10) (Taptic Engine 模拟)。  
  * 点击时增加按压态 (Scale Down) 动画。

### **3.4 触觉反馈体系 (Haptics System)**

规范化震动反馈：

* **Success**: 单次短震 (tick).  
* **Warning**: 双次短震.  
* **Error**: 长震或重震 (thud).  
* **Selection**: 滚动选择器（如日期选择）时极轻微的震动。

## **4\. 组件规范更新**

所有可点击元素必须具有：

1. **Min Size**: 44x44pt 点击热区。  
2. **Active State**: CSS active:scale-95 或 active:opacity-70。