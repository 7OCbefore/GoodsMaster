# **TDD-001: 本地优先数据架构升级 (Local-First Data Architecture)**

| Metadata | Details |
| :---- | :---- |
| **Status** | Draft |
| **Author** | System Architect |
| **Created** | 2025-12-15 |
| **Priority** | P0 (Critical) |

## **1\. 背景与问题 (Context)**

当前的 GoodsMaster Pro 使用 localStorage 进行数据持久化，并通过 watch 监听 Vue 响应式对象的变化进行同步全量写入。

### **1.1 痛点**

1. **主线程阻塞 (Main Thread Blocking)**: localStorage 是同步 I/O。当 salesHistory 达到数千条时，JSON 序列化 (JSON.stringify) 和写入操作会导致 UI 掉帧（Jank），尤其是在低端移动设备上。  
2. **容量限制**: localStorage 通常限制为 5MB。对于长期经营数据，这很容易触顶，导致数据丢失或写入失败。  
3. **计算开销**: 核心业务指标（如库存 WAC 成本、报表统计）依赖前端实时计算 (computed)。随着数据量增长，计算复杂度为 O(N)，导致交互响应变慢。

## **2\. 目标 (Goals)**

1. **异步存储**: 迁移至 IndexedDB，将 I/O 操作移出主线程。  
2. **高性能计算**: 引入 Web Workers 处理复杂的数据聚合与报表生成。  
3. **海量数据支持**: 支持 10万+ 订单级别的流畅运行。  
4. **数据安全**: 建立自动备份与快照机制。

## **3\. 技术方案 (Technical Design)**

### **3.1 存储层：引入 Dexie.js**

使用 [Dexie.js](https://dexie.org/) 作为 IndexedDB 的包装库，提供类 ORM 的体验和 TypeScript 支持。

**Schema 设计:**

const db \= new Dexie('GoodsMasterDB');  
db.version(1).stores({  
  packages: '++id, batchId, timestamp, verified', // 索引字段  
  sales: '++id, timestamp, customer',  
  goods: '++id, name', // 商品主数据  
  snapshots: '++id, date, type' // 库存/财务快照  
});

### **3.2 计算层：Web Worker 管道**

将 useStore.js 中的重型计算拆分。

* **Main Thread**: 仅维护 UI 所需的“当前视图数据”（如当前页的20条订单、今日概览数据）。  
* **Worker Thread**:  
  * 监听数据库变更。  
  * 执行全量库存计算 (WAC Algorithm)。  
  * 生成 Excel 导出数据。  
  * 生成月度/年度报表数据。  
  * 计算结果通过 postMessage 返回给主线程进行渲染。

### **3.3 快照机制 (Snapshot Strategy)**

为了避免每次重新计算所有历史数据，引入“快照”概念：

* **日结快照**: 每天凌晨（或用户首次打开）生成前一天的库存数量和成本快照。  
* **计算逻辑**: Current Inventory \= Last Snapshot \+ New Packages \- New Sales。

## **4\. 迁移策略 (Migration Strategy)**

1. **双写阶段 (Dual Write)**:  
   * 同时写入 LocalStorage 和 IndexedDB。  
   * 读取优先使用 LocalStorage，IndexedDB 仅用于验证数据一致性。  
2. **数据迁移工具 (Migration Script)**:  
   * 用户首次更新版本时，检测 LocalStorage 数据。  
   * 启动迁移脚本将其导入 IndexedDB。  
   * 成功后清除 LocalStorage 并标记 MIGRATION\_COMPLETE。  
3. **切换读取**:  
   * 全面切换至 Dexie.js 读取数据。

## **5\. 风险与缓解**

* **浏览器兼容性**: 现代浏览器对 IndexedDB 支持良好。针对极少数不支持的环境，保留 LocalStorage 作为 Fallback 模式。  
* **异步复杂性**: UI 需要处理“加载中”状态。需要引入 Suspense 或骨架屏 (Skeleton Screens)。