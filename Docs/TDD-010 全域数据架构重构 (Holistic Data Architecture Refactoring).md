# **TDD-010: 全域数据架构重构 (Holistic Data Architecture Refactoring)**

| Metadata | Details |
| :---- | :---- |
| **Status** | Draft |
| **Author** | System Architect |
| **Priority** | P0 (Critical for Cloud Sync) |
| **Goal** | 建立完整、一致、可扩展的领域模型，消除数据孤岛，确保云端备份的完整性。 |

## **1\. 问题诊断 (Problem Analysis)**

当前数据架构存在以下“反模式”：

1. **隐式主数据 (Implicit Master Data)**: 商品仅作为字符串存在于 goodsList 数组和 packages 表中。如果没有进货记录，系统就“不认识”这个商品。  
2. **配置碎片化**: 商品售价 (sellPrice) 存储在 settings 表的一个大 JSON 字段中。这导致：  
   * 无法对单个商品的定价进行最后更新时间 (updated\_at) 追踪。  
   * 云端同步时，修改一个价格需要覆盖整个 JSON，容易产生冲突。  
3. **缺乏引用完整性**: 销售记录中的 items 仅存储了商品名称。如果未来商品改名，历史数据与新数据将断连。

## **2\. 目标架构 (Target Architecture)**

我们需要引入 **"商品主档 (Product Master)"** 概念。

### **2.1 核心实体关系 (ERD)**

erDiagram  
    Products ||--o{ Packages : "restocked\_in"  
    Products ||--o{ SaleItems : "sold\_as"  
      
    Products {  
        uuid id PK "主键"  
        string name "商品名称"  
        string barcode "条码 (新增)"  
        decimal price "当前售价"  
        decimal last\_cost "最新进价 (缓存)"  
        int stock\_warning "预警阈值 (新增)"  
    }  
      
    Packages {  
        uuid id PK  
        uuid product\_id FK "关联商品ID"  
        string product\_name\_snapshot "冗余快照"  
        int quantity  
        decimal cost  
    }

## **3\. 表结构设计 (Schema Definition)**

除了现有的 packages 和 sales，必须新增 **products** 表。

### **3.1 Products (商品主表) \- *NEW***

这是系统的核心资产表。

* id (uuid): 全局唯一标识符。  
* user\_id (uuid): 单租户归属。  
* name (text): 商品名称。  
* barcode (text, nullable): 条形码（为扫码枪准备）。  
* price (numeric): 默认建议售价。  
* category (text, nullable): 分类（如“卷烟”、“饮料”）。  
* stock\_warning (int): 独立设置的库存预警线（默认 5）。  
* updated\_at, is\_deleted: 同步元数据。

### **3.2 Packages (进货表) \- *Optimization***

* **新增** product\_id (uuid): 关联到 products.id。  
* **保留** content (text): 作为历史快照，防止商品删除后进货单无法显示。

### **3.3 Sales (销售表) \- *Optimization***

* items (jsonb): 内部结构升级。  
  * 旧: \[{ name: "黄鹤楼", quantity: 1 }\]  
  * 新: \[{ productId: "uuid...", name: "黄鹤楼", quantity: 1, ... }\]

## **4\. 为什么不需要 "Inventory" 表？**

在 Google/Facebook 这种海量数据架构中，库存通常有两种设计：

1. **Ledger 模式 (推荐)**: 库存 \= Sum(In) \- Sum(Out)。我们目前就是这种模式（WAC算法）。它是最准确的，永远不会出现“库存表说有货，但找不到进货记录”的数据不一致。  
2. **Snapshot 模式**: 每天生成一个快照。

**结论**: 我们保持 Ledger 模式，不建立独立的 inventory 物理表，但在 Products 表中可以增加一个 cached\_stock 字段用于快速读取（非强制）。

## **5\. 迁移策略 (Migration Strategy)**

由于是破坏性变更，需要编写迁移脚本：

1. **Extract**: 遍历本地所有的 packages 和 goodsList。  
2. **Transform**: 为每个唯一的商品名生成一个 UUID，创建 Product 对象。将 settings.sellPrice 中的价格迁移到 Product.price。  
3. **Load**: 写入 products 表。  
4. **Re-link**: 更新 packages 和 sales，回填 product\_id。