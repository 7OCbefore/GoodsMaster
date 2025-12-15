# **TDD-009: 单租户隐式同步架构 (Single-Tenant Implicit Sync)**

| Metadata | Details |
| :---- | :---- |
| **Status** | Draft |
| **Author** | System Architect |
| **Priority** | P1 (Architecture Change) |
| **Goal** | 移除前端用户登录流程，实现基于预设身份的自动后台同步。 |

## **1\. 架构原则 (Philosophy)**

从 **"Multi-User (多用户)"** 切换为 **"Single-Tenant (单租户)"** 模式。

* **身份验证 (Auth)**: 废弃前端交互式登录。采用 **隐式身份 (Implicit Identity)**。  
* **数据安全 (Security)**: 虽然没有登录，但数据库依然需要 RLS (行级安全) 保护。我们将使用一个**全局固定的 UUID** 作为所有数据的归属者。  
* **用户体验 (UX)**: 用户打开 App 即处于“已连接”状态，同步在后台静默发生。

## **2\. 数据库安全策略调整 (RLS Update)**

由于不再通过 auth.uid() 获取动态用户 ID，我们需要修改 RLS 策略，允许 anon (匿名) 角色读写特定的全局用户数据。

### **2.1 引入全局标识符**

在 .env 中定义一个静态 UUID：  
VITE\_GLOBAL\_USER\_ID="00000000-0000-0000-0000-000000000001" (或者任何生成的 UUID)

### **2.2 SQL 策略变更**

Supabase 的 RLS 策略需要更新，允许带有特定 user\_id 的匿名操作。

\-- 允许匿名角色操作指定 user\_id 的数据  
create policy "Allow anon access to global user"  
on public.packages  
for all  
to anon  
using (user\_id \= 'YOUR\_GLOBAL\_UUID\_HERE');

## **3\. 代码层改造**

### **3.1 移除 Auth UI**

* 删除 src/views/LoginView.vue。  
* 删除路由守卫中的登录检查。  
* SettingsView.vue 移除登录/登出按钮，改为显示“云同步状态：在线/离线”。

### **3.2 改造 Supabase Client**

* getCurrentUser(): 不再请求 Supabase Auth，而是直接返回硬编码的 VITE\_GLOBAL\_USER\_ID。  
* 初始化时不再检查 Session。

### **3.3 改造 Sync Service**

* 移除所有 if (\!user) return 的鉴权守卫。  
* 确保同步任务在 App 启动 (main.ts) 时自动挂载。

## **4\. 风险评估**

* **公开访问风险**: 如果项目部署在公网，任何人知道你的 Supabase URL 和 Key 都能读写数据。  
* **缓解措施**: 这种架构仅适用于**本地运行**或**内网部署**。如果是公网部署，建议在 Supabase 后台开启 IP 白名单，或者在 Request Header 中增加自定义 Secret 校验。