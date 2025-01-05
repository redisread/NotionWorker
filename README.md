# NotionWorker

NotionWorker 是一个基于 Cloudflare Workers 的 Notion API 集成服务，提供了便捷的 Notion 数据库和页面管理功能。

## 功能特点

- 📚 Notion 数据库查询和管理
- 📝 Notion 页面操作
- 🔍 支持按日期范围过滤页面
- 🌐 网页内容自动摘要功能
- 🤖 AI 集成支持
- 🔒 安全的 API 密钥管理
- 💻 友好的 Web 界面

## 快速开始

### 前置要求

- Node.js (推荐 v16+)
- pnpm 包管理器
- Notion API Token
- Cloudflare 账号

### 安装

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 部署到 Cloudflare Workers
pnpm run deploy
```

### 配置

1. 在 [Notion Developers](https://developers.notion.com/) 获取 API Token
2. 配置 `wrangler.toml` 文件（如需要）
3. 在使用 Web 界面时输入你的 Notion Token 和数据库 ID

## API 接口

### Notion 数据库操作

- `POST /notion/database/retrieve` - 获取数据库信息
- `POST /notion/database/query` - 查询数据库内容

### Notion 页面操作

- `GET /notion/pages` - 页面查询界面
- 支持按日期范围筛选页面

### AI 功能

- `POST /notion/ai` - AI 相关功能接口

## 开发

本项目使用以下技术栈：

- Cloudflare Workers
- Hono 框架
- TypeScript
- Notion API

## 许可证

MIT License 