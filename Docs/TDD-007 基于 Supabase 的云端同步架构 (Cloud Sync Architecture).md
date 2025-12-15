# **TDD-007: 基于 Supabase 的云端同步架构 (Cloud Sync Architecture)**

| Metadata | Details |
| :---- | :---- |
| **Status** | Draft |
| **Author** | System Architect |
| **Priority** | P0 (Strategic) |
| **Stack** | Supabase (PostgreSQL, Auth, RLS) |

## **1\. 架构原则 (Philosophy)**

采用 **"Local-First, Cloud-Sync"** 策略。

* **读取 (Read)**: UI 始终从 Dexie (IndexedDB) 读取数据。  
* **写入 (Write)**: UI 写入 Dexie \-\> 触发 Sync Worker \-\> 队列推送至 Supabase。  
* **同步 (Sync)**: 监听 Supabase 变更 (Realtime/Polling) \-\> 更新 Dexie \-\> UI 响应式更新。

## **2\. 数据库设计 (Schema Design)**

为了支持同步，需要在 Postgres 中建立与本地 domain.ts 对应的表，并增加同步元数据。

### **2.1 核心表结构**

所有表必须包含 user\_id (UUID) 以支持多租户隔离。

* **public.packages** (进货表)  
  * id (bigint, PK)  
  * user\_id (uuid, FK \-\> auth.users)  
  * batch\_id, tracking, content, quantity, cost\_price...  
  * updated\_at (timestamptz) \-用于增量同步  
  * is\_deleted (boolean) \- 软删除支持  
* **public.sales** (销售表)  
  * id (bigint, PK)  
  * user\_id (uuid)  
  * items (jsonb) \- 存储商品快照数组  
  * total\_amount, total\_profit...  
  * updated\_at, is\_deleted

### **2.2 安全策略 (RLS \- Row Level Security)**

必须启用 RLS，严禁客户端直接访问非己方数据。

* Policy: Users can only select/insert/update/delete their own data (auth.uid() \= user\_id).

## **3\. 同步机制 (Sync Mechanism)**

### **3.1 推送 (Push: Local \-\> Cloud)**

在 useStore 的 Action 中，操作 Dexie 成功后，将变更记录加入 SyncQueue。  
后台进程（或 Service Worker）消费队列，调用 Supabase SDK 写入云端。

### **3.2 拉取 (Pull: Cloud \-\> Local)**

* **全量拉取**: 用户登录或首次加载时。  
* **增量拉取**: 记录 last\_synced\_at 时间戳，只拉取 updated\_at \> last\_synced\_at 的数据。

## **4\. 冲突解决 (Conflict Resolution)**

采用 **LWW (Last Write Wins)** 策略。以 updated\_at 最新的为准。由于业务场景多为单人操作或追加操作，冲突概率极低。