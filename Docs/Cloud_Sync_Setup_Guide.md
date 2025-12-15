# GoodsMaster - 云端同步功能配置指南

本指南介绍了如何配置和使用 GoodsMaster 的云端同步功能。

## 功能概述

GoodsMaster 现在支持基于 Supabase 的云端数据同步功能，具有以下特点：

- **本地优先**：应用始终从本地 IndexedDB 读取数据，保证快速响应
- **后台同步**：数据变更会自动同步到云端
- **多端同步**：支持在多个设备间同步数据
- **离线可用**：即使没有网络连接，应用也能正常使用

## 配置步骤

### 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并创建一个新项目
2. 记下项目 URL 和匿名密钥（anon key）

### 2. 设置数据库表结构

在 Supabase SQL 编辑器中运行 `supabase_schema.sql` 文件中的 SQL 语句来创建表结构。

### 3. 配置环境变量

复制 `.env.example` 文件为 `.env` 并填入你的 Supabase 信息：

```env
VITE_SUPABASE_URL=你的_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=你的_SUPABASE_ANON_KEY
```

> 注意：确保 `.env` 文件已添加到 `.gitignore` 中，不要提交到代码仓库。

### 4. 启用身份验证

确保在 Supabase 项目中启用了身份验证功能，并配置了所需的登录方式（如邮箱密码登录）。

## 使用说明

### 登录与同步

1. 应用启动时会自动尝试同步云端数据
2. 如果未登录，可以先以访客模式使用应用
3. 在设置页面可以登录或注册账户

### 手动同步

在设置页面中提供了以下同步选项：

- **同步云端数据**：从云端下载最新数据覆盖本地
- **备份到云端**：将本地数据上传到云端

## 技术架构

### 数据流向

1. **读取**：UI 始终从 Dexie (IndexedDB) 读取数据
2. **写入**：UI 写入 Dexie → 触发 Sync Service → 队列推送至 Supabase
3. **同步**：监听 Supabase 变更 → 更新 Dexie → UI 响应式更新

### 冲突解决

采用 **LWW (Last Write Wins)** 策略，以 `updated_at` 最新的为准。

## API 说明

### syncService

核心同步服务，提供了以下方法：

- `pushToCloud(table, data)` - 将数据推送到云端
- `pullFromCloud()` - 从云端拉取数据
- `sync()` - 执行完整同步流程
- `backupToCloud()` - 全量备份数据到云端

## 故障排除

### 同步失败

- 检查网络连接
- 确认 Supabase 配置是否正确
- 检查用户是否已登录
- 查看浏览器控制台的错误信息

### 数据不一致

- 尝试手动同步云端数据
- 检查 RLS（Row Level Security）策略是否正确配置

## 安全考虑

- 所有数据访问都通过 RLS 策略限制，用户只能访问自己的数据
- 敏感信息（如 API 密钥）通过环境变量管理
- 数据传输使用 HTTPS 加密