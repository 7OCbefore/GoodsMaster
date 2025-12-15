# **TDD-003: 工程化与质量体系建设 (Engineering Excellence)**

| Metadata | Details |
| :---- | :---- |
| **Status** | Draft |
| **Author** | Lead Developer |
| **Created** | 2025-12-15 |
| **Priority** | P1 (High) |

## **1\. 背景 (Context)**

项目目前为纯 JavaScript，缺乏类型约束。核心算法（如金额计算）缺乏自动化测试保护，每次重构都存在破坏业务逻辑的风险。

## **2\. 目标 (Goals)**

1. **类型安全**: 消除 undefined 引用错误，提供 IDE 智能提示。  
2. **质量守护**: 核心逻辑测试覆盖率 \> 90%。  
3. **代码规范**: 统一 Google/Airbnb 代码风格。

## **3\. 技术方案 (Technical Design)**

### **3.1 TypeScript 迁移**

渐进式迁移策略：

1. **配置**: 添加 tsconfig.json，启用 allowJs: true。  
2. **核心类型定义 (src/types/)**:  
   // domain.ts  
   export interface OrderItem {  
     name: string;  
     quantity: number;  
     sellPrice: number; // 这里的金额单位建议改为“分” (integer)，避免浮点数误差  
     costSnapshot: number;  
   }

   export interface Order {  
     id: string;  
     timestamp: number;  
     items: OrderItem\[\];  
     status: 'completed' | 'refunded';  
   }

3. **模块迁移**: 优先迁移 useStore.js \-\> useStore.ts，利用类型系统重构状态管理。

### **3.2 自动化测试策略**

* **单元测试 (Unit Test)**: 使用 Vitest。  
  * **重点对象**: useStore 中的 WAC 算法、useExport 导出逻辑、金额格式化函数。  
  * **示例**:  
    test('WAC calculation should be correct', () \=\> {  
       // Arrange: 进货 10个@10元, 进货 10个@20元  
       // Act: 计算库存均价  
       // Assert: 均价应为 15元  
    });

* **端到端测试 (E2E Test)**: 使用 Playwright。  
  * **关键路径 (Critical Paths)**:  
    1. 进入“进货页” \-\> 手动录入商品 \-\> 验证列表更新。  
    2. 进入“开单页” \-\> 加购商品 \-\> 修改数量 \-\> 结算 \-\> 验证“总览页”数据变化。

### **3.3 Linting & Formatting**

* 引入 ESLint \+ Prettier。  
* 启用 vue-tsc 进行构建时类型检查。  
* 配置 Git Hooks (husky \+ lint-staged)：提交前自动运行 Lint 和 Unit Tests。

### **3.4 金额处理标准**

* **原则**: 废除前端直接进行浮点数运算（如 0.1 \+ 0.2）。  
* **方案**: 引入 decimal.js 或 currency.js，或者统一在数据层存储为“分”（整数），仅在显示层格式化为“元”。

## **4\. CI/CD 增强**

更新 .github/workflows/ci.yml:

* 增加 npm run type-check 步骤。  
* 增加 npm run test:unit 步骤。  
* (可选) 增加 Playwright 测试步骤（需配置 Headless Browser 环境）。