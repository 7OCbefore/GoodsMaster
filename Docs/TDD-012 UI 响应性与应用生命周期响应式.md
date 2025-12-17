# **Troubleshooting Guide: UI Reactivity & App Lifecycle**

# **故障排查指南：UI 响应性与应用生命周期**

| 属性 | 内容 |
| :---- | :---- |
| **Status** | Stable |
| **Author** | System Architect |
| **Date** | 2025-09-20 |
| **Component** | Frontend UI, Sync Service |

## **1\. Issue A: 删除操作后 UI 未刷新 (Stale UI State)**

### **1.1 现象描述 (Symptom)**

用户在 UI 上点击删除按钮，数据库中的记录已被正确处理（物理删除或标记删除），但 UI 列表依然显示该记录。手动刷新页面后，记录消失。

### **1.2 根本原因 (Root Cause)**

内存状态与持久化状态分离 (State Drift)。  
当前的 UI 组件通常在 onMounted 生命周期中执行一次性查询（One-time Fetch），将数据库数据复制到 Vue 的响应式变量（如 ref）中。当执行删除操作时，修改的是 Dexie 数据库，而 Vue 内存中的数组 并没有感知到这一变化。  
// ❌ 问题代码示例 (Anti-Pattern)  
const products \= ref(\[\]);

// 1\. 仅在组件加载时获取一次数据  
onMounted(async () \=\> {  
  products.value \= await db.products.toArray();   
});

const handleDelete \= async (id) \=\> {  
  // 2\. 这里的操作只影响了数据库，products.value 数组没有任何变化！  
  await db.products.delete(id);   
};

### **1.3 解决方案 (Solution)**

我们提供两种符合 Google 标准的解决路径：**乐观更新 (Optimistic UI)** 或 **实时查询 (Live Query)**。建议优先采用方案 B。

#### **方案 A：手动状态变更 (Manual Mutation / Optimistic UI)**

适用于简单场景。在数据库操作成功后，手动更新前端数组。

// ✅ 修复代码示例  
const handleDelete \= async (id: string) \=\> {  
  try {  
    // 1\. 执行数据库操作  
    await store.deleteProduct(id);  
      
    // 2\. 手动更新 UI 状态 (如果在 Store 中使用了 Pinia/Vue Reactivity，这一步应在 Store Action 中完成)  
    products.value \= products.value.filter(item \=\> item.id \!== id);  
      
    showToast('删除成功');  
  } catch (e) {  
    console.error(e);  
  }  
};

#### **方案 B：响应式实时查询 (Live Query) \- 推荐**

利用 dexie 的 useLiveQuery（需要配合 @vueuse/rxjs 或简单的 Vue 封装），让 UI 自动与数据库保持同步。这是“本地优先”架构的最佳实践。

第一步：安装依赖 (如果未安装)  
虽然 VueUse 很强大，但简单的封装也可以：  
**第二步：在组件中使用**

// src/views/InventoryView.vue (示例)  
import { liveQuery } from "dexie";  
import { useObservable } from "@vueuse/rxjs";  
import { db } from "../db";

// 创建一个 Observable  
const productsObservable \= liveQuery(() \=\> db.products.toArray());

// 使用 VueUse 将其转换为响应式 ref  
const products \= useObservable(productsObservable);

// 现在，任何对 db.products 的修改（增删改）都会自动触发 products 更新，无需手动干预

## **2\. Issue B: 刷新页面触发云端操作 (Lifecycle & Sync Triggers)**

### **2.1 原理分析 (Mechanism)**

Web 应用的“刷新”本质上是程序的重启。  
当用户点击刷新（F5）时：

1. 浏览器卸载当前页面，清空所有内存变量（Pinia Store, Refs 等全部归零）。  
2. 重新下载/解析 index.html 和 main.ts。  
3. 重新挂载 App.vue。  
4. 重新实例化 Supabase 客户端和数据库连接。

### **2.2 触发源排查 (Trace)**

你的应用中“刷新即触发操作”通常源于以下位置：

1. Supabase Auth 初始化 (src/services/supabase.ts 或 main.ts)  
   Supabase 客户端启动时，会自动检查 localStorage 中的 Session Token 是否有效，甚至尝试刷新 Token。这是一个网络请求。  
2. 根组件挂载 (src/App.vue)  
   如果在 App.vue 的 onMounted 中调用了 syncData 或 fetchData，那么每次刷新都会执行。  
   // src/App.vue  
   onMounted(() \=\> {  
     // ⚠️ 如果这里有代码，刷新必然触发  
     // syncService.syncData();   
     // userStore.initialize();  
   });

3. Store 初始化 (src/composables/useStore.ts)  
   如果 Store 采用了 Setup Store 写法，且在代码顶层直接执行了某些逻辑（而非在函数内部），这些逻辑会在文件被 import 时立即执行。

### **2.3 开发建议 (Best Practices)**

1. **区分“启动同步”与“交互同步”**：  
   * **启动同步**：应用启动时尝试一次快速同步（拉取最新数据）是合理的，但这不应该阻塞 UI。  
   * **被动触发**：如果担心流量，可以设置一个 flag，仅在 last\_sync\_time 超过一定阈值（如 1 小时）时才在启动时触发同步。  
2. 调试技巧：  
   在 src/App.vue 或 src/main.ts 中添加日志，确认启动流程：  
   console.log('\[App\] Application mounted');  
   // 检查调用栈，看谁触发了网络请求

3. 避免副作用：  
   确保副作用（Side Effects，如网络请求、数据库写入）只在明确的 Action 或生命周期钩子中发生，不要直接写在模块的顶层作用域中。

## **3\. 总结 (Summary)**

| 问题 | 解决方案 | 复杂度 | 推荐指数 |
| :---- | :---- | :---- | :---- |
| **删除后 UI 不变** | 方案 A: filter 手动移除 | 低 | ⭐⭐⭐ |
|  | 方案 B: useLiveQuery 自动响应 | 中 | ⭐⭐⭐⭐⭐ (架构级解法) |
| **刷新触发同步** | 这是一个特性而非 Bug。如果需要优化，请在 App.vue 中添加时间间隔检查逻辑。 | 低 | \- |

