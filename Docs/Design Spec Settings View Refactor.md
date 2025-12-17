# **Design Spec: Settings View Refactor**

# **设计规范：设置页面重构**

| 属性 | 内容 |
| :---- | :---- |
| **Status** | Approved |
| **Author** | System Architect |
| **Date** | 2025-09-20 |
| **Target Component** | src/views/SettingsView.vue |
| **Design System** | GoodsMaster Dark Theme (Mobile First) |

## **1\. 概述 (Overview)**

当前的设置页面信息密度过大，缺乏视觉层级，容易导致用户在“日常同步”与“高风险恢复”操作之间产生混淆。

本设计旨在通过**卡片式分组 (Card Grouping)** 和 **视觉分层 (Visual Hierarchy)**，提升可读性，降低误操作风险，并保持与应用整体“极简、暗黑、沉浸式”风格的一致性。

## **2\. 视觉设计规范 (Visual Design Specifications)**

### **2.1 布局与栅格 (Layout & Grid)**

* **容器背景**: bg-black (全黑沉浸式背景)。  
* **内容内边距**: 左右 px-4 或 px-6，确保手指在大屏手机边缘的操作舒适度。  
* **卡片圆角**: rounded-2xl (16px)，与 iOS/Android 现代设计语言保持一致。  
* **卡片间距**: space-y-6 (24px)，明确区分不同的功能区块。

### **2.2 色彩体系 (Color System)**

* **文字层级**:  
  * **一级标题 (H1)**: text-white (Opacity 100%), font-bold, text-3xl。  
  * **二级标题 (Section Header)**: text-accent 或 text-white/40, font-bold, uppercase, text-xs, tracking-wider。  
  * **正文/操作项**: text-white (Opacity 90%)。  
  * **辅助说明/副标题**: text-white/50 或 text-white/30。  
* **容器色彩**:  
  * **标准卡片**: bg-white/10 (10% 白色透明度) \+ backdrop-blur-md (毛玻璃效果) \+ border-white/5。  
  * **危险卡片**: bg-red-500/10 \+ border-red-500/20。  
* **品牌色 (Accent)**:  
  * 使用全局定义的 text-accent / bg-accent (通常为蓝色 \#0A84FF)，用于强调“云端同步”等核心正向操作。

### **2.3 交互组件 (Interactive Components)**

#### **A. 主操作按钮 (Primary Action Button)**

* **用途**: 高频、正向的核心功能（如“立即同步”）。  
* **样式**: 实心填充 bg-accent，高亮显眼。  
* **反馈**: 点击时缩放 active:scale-\[0.98\]，加载时显示旋转图标。

#### **B. 列表操作项 (List Item Action)**

* **用途**: 次级功能（如“导出”、“恢复”）。  
* **样式**: 透明背景，点击时背景变亮 hover:bg-white/5。  
* **结构**:  
  * 左侧：标题 \+ 辅助说明文案（两行结构）。  
  * 右侧：Chevron 图标 (ph-caret-right) 或 功能图标 (ph-download)。

## **3\. 详细设计方案 (Detailed Design)**

### **3.1 页面头部 (Header)**

* **布局**: 顶部大标题，留白充足。  
* **文案**:  
  * Title: "设置"  
  * Subtitle: "管理数据同步与应用偏好"

### **3.2 区块一：云端同步 (Cloud Sync)**

* **设计意图**: 这是用户进入此页面的主要原因，放在最上方且视觉最重。  
* **状态行**: 显示“上次同步时间”，字体使用 font-mono 增加数据感。  
* **核心按钮**: "立即同步" (Primary Button)，占据整行，带有 Loading 状态。  
* **恢复入口**: "从云端恢复" (Secondary Item)，**必须**包含一行小字说明：“用于找回误删数据”，以区分于普通同步。

### **3.3 区块二：数据管理 (Data Management)**

* **设计意图**: 低频工具类操作。  
* **样式**: 通用列表组 (List Group)，包含“导出数据”和“导入数据”。使用分割线 divide-y divide-white/5 分隔。

### **3.4 区块三：危险区域 (Danger Zone)**

* **设计意图**: 防止误触。  
* **样式**: 红色调。  
* **功能**: "清空所有数据/重置数据库"。点击必须触发二次确认弹窗。

### **3.5 底部信息 (Footer)**

* **内容**: App Logo (占位符或图标)、版本号、架构标语 ("Local-First Architecture")。  
* **样式**: 极淡的灰色 text-white/20，居中对齐。

## **4\. 逻辑实现规范 (Implementation Specs)**

### **4.1 状态管理 (State)**

* lastSyncTime (ref string): 从 localStorage 读取 ISO 时间并格式化为本地可读字符串。  
* isSyncing (ref boolean): 全局加载锁，防止重复点击。

### **4.2 核心动作 (Actions)**

| 动作名称 | 触发函数 | 参数配置 | 预期行为 |
| :---- | :---- | :---- | :---- |
| **立即同步** | handleSync | { pruneLocallyDeleted: true, forceFullPull: false } | 执行标准同步，上传本地删除，拉取最新修改。 |
| **云端恢复** | handleRecovery | { pruneLocallyDeleted: false, forceFullPull: true } | **弹窗确认** \-\> 禁止剪枝，强制全量拉取 \-\> 提示成功。 |
| **清空数据** | handleReset | N/A | **红色警示弹窗** \-\> db.delete() \-\> 清空 LocalStorage \-\> 刷新 UI。 |

## **5\. 预期代码结构 (Scaffold)**

\<template\>  
  \<div class="min-h-screen bg-black text-white font-sans"\>  
    \<\!-- Header \--\>  
    \<header\>...\</header\>

    \<div class="content-container"\>  
      \<\!-- Card 1: Sync \--\>  
      \<section\>  
        \<h2\>云端同步\</h2\>  
        \<div class="glass-card"\>  
           \<status-row /\>  
           \<primary-button /\> \<\!-- Sync \--\>  
           \<secondary-button /\> \<\!-- Recovery \--\>  
        \</div\>  
      \</section\>

      \<\!-- Card 2: Data \--\>  
      \<section\>  
        \<h2\>数据管理\</h2\>  
        \<div class="glass-card"\>  
           \<list-item /\> \<\!-- Export \--\>  
           \<list-item /\> \<\!-- Import \--\>  
        \</div\>  
      \</section\>

      \<\!-- Card 3: Danger \--\>  
      \<section\>  
        \<h2 class="text-red"\>危险区域\</h2\>  
        \<div class="red-glass-card"\>  
           \<danger-item /\>  
        \</div\>  
      \</section\>  
        
      \<\!-- Footer \--\>  
      \<footer\>...\</footer\>  
    \</div\>  
  \</div\>  
\</template\>  

## **6\. Iconography (图标系统)**
- 使用 phosphor-icons (ph-bold) 保持一致性：
- 同步: ph-arrows-clockwise
- 恢复: ph-cloud-arrow-down
- 导出: ph-export
- 导入: ph-download-simple
- 警告/删除: ph-trash
- 箭头: ph-caret-right