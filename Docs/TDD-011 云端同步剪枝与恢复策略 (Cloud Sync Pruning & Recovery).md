# **TDD-011 云端同步剪枝与恢复策略 (Cloud Sync Pruning & Recovery)**

| 属性 | 内容 |
| :---- | :---- |
| **Status** | Draft |
| **Author** | System Architect |
| **Date** | 2025-09-19 |
| **Tags** | Cloud Sync, Offline-First, Supabase, Dexie |

## **1\. 背景与目标 (Context & Goals)**

当前系统采用“本地优先”架构。用户希望优化云端同步机制，以支持更灵活的数据管理：

1. **剪枝 (Pruning)**：本地删除数据后，云端不进行物理删除，而是标记为 is\_delete=true（软删除）。且被标记删除的数据不应再被拉取回本地。  
2. **恢复 (Recovery)**：支持一种特殊的同步操作，通过“先增量推送（不剪枝）后拉取”的方式，利用云端仍存活的数据恢复本地误删的数据。

## **2\. 核心挑战 (Key Challenges)**

* **本地物理删除与追踪**：Dexie.js 删除记录是物理删除。一旦删除，无法直接获知“哪些 ID 被删除了”。需要引入“墓碑 (Tombstone)”机制。  
* **同步原子性与顺序**：必须严格控制 Push Upsert、Push Delete 和 Pull 的执行顺序，以满足“误删恢复”的需求。  
* **流量控制**：全量拉取成本较高，需在“恢复”与“性能”之间取得平衡。

## **3\. 架构设计 (Architecture Design)**

### **3.1 数据库 Schema 变更**

#### **3.1.1 云端 (Supabase)**

已存在 is\_deleted 字段（基于 supabase\_schema.sql），无需变更。确保 RLS (Row Level Security) 策略允许更新该字段。

\-- 确保查询时默认过滤掉已删除数据（可选，或在客户端过滤）  
\-- CREATE VIEW active\_products AS SELECT \* FROM products WHERE is\_deleted \= false;

#### **3.1.2 本地 (Dexie.js)**

需要新增一张表来追踪待同步的删除操作。

// src/db/index.ts Interface  
export interface DeletedRecord {  
  id: string; // 被删除记录的 UUID  
  tableName: string; // 'products' | 'orders' etc.  
  deletedAt: number; // 时间戳  
}

// Dexie Schema Update  
// db.version(X).stores({  
//   ...  
//   deleted\_records: 'id, tableName' // 简单的键值索引  
// });

### **3.2 逻辑流程图**

#### **场景 A：标准同步 (执行剪枝)**

用于日常同步，确保本地的删除操作同步到云端。

1. **Local Upsert Push**: 查找 last\_modified \> last\_sync\_time 的记录 \-\> upsert 到 Supabase。  
2. **Local Prune Push**: 查找 deleted\_records 表 \-\> update table set is\_deleted=true 到 Supabase。  
3. **Cleanup**: 如果 Prune 成功，从本地 deleted\_records 删除对应记录。  
4. **Cloud Pull**: 拉取 updated\_at \> last\_sync\_time AND is\_deleted \= false 的数据 \-\> put 到本地。

#### **场景 B：恢复模式同步 (不剪枝 \+ 恢复)**

用于用户误删后，试图从云端找回数据。

1. **Local Upsert Push**: 同上（保护本地新增未上传的数据）。  
2. **Skip Prune**: **跳过**读取 deleted\_records 步骤。  
3. **Cloud Pull (Full/Wide)**: 拉取云端 is\_deleted \= false 的有效数据。  
   * *优化*：可以只拉取 ID 存在于本地 deleted\_records 中的云端数据（精准恢复），或者执行全量拉取（兜底）。  
4. **Reconcile (和解)**:  
   * 对于拉取到的数据，如果其 ID 存在于本地 deleted\_records 中：  
     * 写入本地业务表 (恢复数据)。  
     * 从 deleted\_records 中移除 (取消删除标记)。

## **4\. 详细实现指南 (Implementation Guide)**

### **4.1 本地删除拦截 (Intercepting Deletion)**

在 useStore 或具体的 Service 层中，封装删除逻辑。**不要直接调用 db.table.delete()**，必须经过封装函数。

// src/services/dbService.ts (伪代码)

async function softDeleteProduct(id: string) {  
  await db.transaction('rw', db.products, db.deleted\_records, async () \=\> {  
    // 1\. 物理删除业务数据 (为了节省本地空间和 UI 逻辑)  
    await db.products.delete(id);  
      
    // 2\. 记录墓碑 (用于同步剪枝)  
    await db.deleted\_records.put({  
      id,  
      tableName: 'products',  
      deletedAt: Date.now()  
    });  
  });  
}

### **4.2 同步服务重构 (Sync Service Refactor)**

修改 src/services/syncService.ts，增加两种同步方法的参数控制。

#### **4.2.1 核心同步函数**

interface SyncOptions {  
  pruneLocallyDeleted: boolean; // true \= 标准同步 (剪枝), false \= 恢复模式  
  forceFullPull: boolean;       // true \= 拉取所有云端数据, false \= 仅增量  
}

export async function executeSync(options: SyncOptions) {  
  const tables \= \['products', 'orders', 'order\_items'\]; // 需同步的表  
    
  // 1\. Push Upserts (始终执行)  
  await pushLocalChanges();

  // 2\. Push Deletes (剪枝 \- 条件执行)  
  if (options.pruneLocallyDeleted) {  
    await pushLocalDeletions();  
  }

  // 3\. Pull (拉取)  
  await pullCloudChanges(options.forceFullPull);  
    
  // 4\. Update Sync Timestamp  
  localStorage.setItem('last\_sync\_time', new Date().toISOString());  
}

#### **4.2.2 推送删除逻辑 (Pruning Logic)**

async function pushLocalDeletions() {  
  // 获取所有待删除记录  
  const pendingDeletes \= await db.deleted\_records.toArray();  
  if (pendingDeletes.length \=== 0\) return;

  // 按表分组  
  const groups \= \_.groupBy(pendingDeletes, 'tableName');

  for (const \[tableName, records\] of Object.entries(groups)) {  
    const ids \= records.map(r \=\> r.id);  
      
    // 调用 Supabase RPC 或 Update  
    // UPDATE tableName SET is\_deleted \= true, last\_modified \= now() WHERE id IN (ids)  
    const { error } \= await supabase  
      .from(tableName)  
      .update({ is\_deleted: true, last\_modified: new Date().toISOString() })  
      .in('id', ids);

    if (\!error) {  
      // 只有云端确认标记为删除后，才移除本地墓碑  
      await db.deleted\_records.bulkDelete(ids);  
    }  
  }  
}

#### **4.2.3 拉取与恢复逻辑 (Pull & Restore Logic)**

async function pullCloudChanges(forceFull: boolean) {  
  const lastSync \= localStorage.getItem('last\_sync\_time');  
    
  for (const tableName of tables) {  
    let query \= supabase.from(tableName).select('\*').eq('is\_deleted', false);  
      
    // 如果不是强制全量，则仅拉取增量  
    if (\!forceFull && lastSync) {  
      query \= query.gt('last\_modified', lastSync);  
    }

    const { data, error } \= await query;  
    if (error || \!data) continue;

    await db.transaction('rw', db.table(tableName), db.deleted\_records, async () \=\> {  
      // 1\. 写入数据  
      await db.table(tableName).bulkPut(data);  
        
      // 2\. 检查这些数据是否在“待删除列表”中 (如果是，说明是误删恢复)  
      const restoredIds \= data.map(d \=\> d.id);  
      // 从 deleted\_records 中移除这些 ID，防止下次同步时又把它们删了  
      await db.deleted\_records  
        .where('tableName').equals(tableName)  
        .and(r \=\> restoredIds.includes(r.id))  
        .delete();  
    });  
  }  
}

## **5\. 用户体验工作流 (UX Workflow)**

1. **常规操作**：  
   * 用户在设置页点击 "立即同步" (Sync Now)。  
   * **Action**: 调用 executeSync({ pruneLocallyDeleted: true, forceFullPull: false })。  
   * **Result**: 本地删除同步到云端，双端一致。  
2. **误删恢复**：  
   * 用户误删了订单 A。  
   * 用户在设置页点击 "从云端恢复" (Restore from Cloud) 或 "撤销删除" (若 UI 支持)。  
   * **Action**: 调用 executeSync({ pruneLocallyDeleted: false, forceFullPull: true }) (或 false，取决于是否只依赖增量)。  
   * **Result**:  
     * 本地的“删除订单 A”指令**被扣留**，未发送给云端。  
     * 系统从云端拉取有效数据。  
     * 云端显示订单 A 仍为 is\_deleted: false，于是发回给本地。  
     * 本地接收订单 A，重新写入 Dexie，并悄悄移除“删除订单 A”的墓碑记录。  
     * 数据恢复。

## **6\. 注意事项 (Caveats)**

* **全量拉取性能**：如果数据量巨大，forceFullPull: true 会很慢。  
  * *优化建议*：在恢复模式下，先获取本地 deleted\_records 的 ID 列表，然后只向 Supabase 请求这些 ID (.in('id', localDeletedIds))。这叫“精准恢复”。  
* **冲突解决**：如果本地修改了 A，同时删除了 A (逻辑矛盾)，通常删除操作发生在修改之后。我们的 deleted\_records 包含时间戳，可以用来做最终判决。  
* **云端存储**：云端 is\_deleted=true 的数据会一直累积。建议在 Supabase 端设置一个定时任务 (pg\_cron) 或 Edge Function，定期物理删除 30 天前的软删除数据。

## **7\. 下一步行动 (Action Plan)**

1. 修改 src/db/index.ts，添加 deleted\_records 表。  
2. 修改 src/composables/useStore.ts (或其他 store)，将 delete 操作改为“物理删除 \+ 记录墓碑”。  
3. 重写 src/services/syncService.ts，实现上述的 pushLocalDeletions 和带参数的 pull 逻辑。