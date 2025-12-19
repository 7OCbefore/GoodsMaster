# **TDD-013: 响应式数据流与实时查询标准 (Reactive Data Flow & Live Queries)**

| 属性 | 内容 |
| :---- | :---- |
| **Status** | Proposed |
| **Author** | System Architect |
| **Date** | 2025-09-20 |
| **Area** | Frontend Architecture, Persistence Layer |

## **1\. 问题定义 (Problem Statement)**

### **1.1 现状描述**

当前系统的云端同步逻辑位于 syncService，数据持久化位于 Dexie (IndexedDB)。当 syncService 完成数据拉取并写入数据库后，Vue 的响应式状态（Store）由于持有的是旧的内存副本，无法感知底层数据库的变化。

### **1.2 用户痛点**

用户必须手动点击刷新（F5）或重新挂载组件才能看到同步回来的新数据。这破坏了“无缝同步”的用户体验。

## **2\. 业界标准解决方案比较 (Comparison of Solutions)**

| 方案 | 描述 | 优点 | 缺点 |
| :---- | :---- | :---- | :---- |
| **手动重刷 (Manual Refetch)** | 同步完成后手动调用 loadData()。 | 实现简单。 | 难以覆盖所有组件；同步逻辑与组件耦合；冗余查询多。 |
| **全局事件总线 (Event Bus)** | 同步后发送 SYNC\_COMPLETE 事件。 | 解耦同步与 UI。 | 随着表增多，维护成本指数上升；无法处理增量局部更新。 |
| **实时查询 (Live Queries) 🌟** | **Google 标准做法**。UI 直接订阅数据库查询结果流。 | **自动响应**；真正的单一数据源；逻辑极简。 | 需要底层数据库支持订阅机制。 |

## **3\. 设计方案 (Proposed Design)**

我们将采用 **Live Query（实时查询）** 模式。在本地优先（Local-first）架构中，数据库被视为“主数据源”，而 Vue Store 则是该数据源的“观察者”。

### **3.1 核心逻辑：数据观察者模式**

利用 Dexie 的 liveQuery 功能，将原本的一次性 Promise 查询转换为一个 **Observable（观察者流）**。

### **3.2 架构调整 (Implementation Steps)**

#### **步骤 1：重构 Store 的数据获取逻辑**

不再在 onMounted 中手动 fetch，而是声明一个持续存在的查询。

// src/composables/useStore.ts (示意代码)  
import { liveQuery } from 'dexie';  
import { useObservable } from '@vueuse/rxjs'; // 推荐使用 VueUse 简化订阅  
import { db } from '../db';

// 🌟 核心：将静态 Ref 改为动态订阅  
// liveQuery 会自动监听该查询涉及的所有表变化  
export const products \= useObservable(  
  liveQuery(() \=\> db.products.where('is\_deleted').equals(0).toArray())  
);

#### **步骤 2：同步服务的解耦**

syncService 现在只需要专注于“往数据库里写数据”，它不需要知道谁在用这些数据，也不需要发送通知。

// src/services/syncService.ts  
async function pullCloudChanges() {  
  const { data } \= await supabase.from('products').select('\*');  
  // 🌟 只要这里写入数据库，上述 products 变量会自动更新，UI 随之变动  
  await db.products.bulkPut(data);  
}

## **4\. 关键优势 (Key Benefits)**

1. **自动性 (Automaticity)**：无论数据是因为云端同步进来、扫码增加、还是由于另一个标签页的修改，当前 UI 都会立即刷新。  
2. **高性能 (Performance)**：Dexie 的 liveQuery 经过优化，只有在相关联的表发生事务修改时才会重新触发计算，且在组件卸载时会自动取消订阅。  
3. **开发效率**：开发者不再需要写繁琐的 fetchData() 和同步状态管理代码，只需要描述“我想要什么数据”。

## **5\. 迁移计划 (Migration Plan)**

1. **Phase 1**: 在 useStore 中引入 liveQuery 和 @vueuse/rxjs 依赖。  
2. **Phase 2**: 针对高频变动的 packages 和 products 列表，将一次性 toArray() 改为 liveQuery。  
3. **Phase 3**: 移除组件中不再需要的 onMounted 刷新逻辑。

*End of Document*