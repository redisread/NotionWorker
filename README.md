# NotionWorker

纯后端 Cloudflare Worker，为快捷指令等客户端提供 Notion 网页收藏、数据库查询和可选 AI 摘要。生产地址：https://shortcut.jiahongw.com 。没有前端页面。

## 开发与验证

使用 Node.js 22+ 和 `pnpm@9.15.9`（版本在 package.json 中固定）。

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

`pnpm check` 执行类型检查、Workers 运行时测试及部署打包检查。测试拦截所有外部请求，不写入真实 Notion。GitHub Actions 在 PR 中执行检查，main 合并后检查通过才部署。

## 密钥

Notion Token 由每次请求的 `notionApiKey` 提供，不保存在 Worker 中。不要把真实请求体或 Token 放入日志、仓库或示例。

AI 摘要可选。启用前在 Cloudflare 配置新的 `DEEPSEEK_API_KEY` Secret：

```sh
pnpm exec wrangler secret put DEEPSEEK_API_KEY
pnpm exec wrangler secret put AI_ACCESS_TOKEN
```

AI_ACCESS_TOKEN 使用随机长字符串，摘要调用必须带 `Authorization: Bearer <AI_ACCESS_TOKEN>`，防止公开接口被滥用产生费用。此校验覆盖 `/notion/ai` 及 create/prepare 的 needSummarize 请求；普通保存无需此请求头。

本地可在被 Git 忽略的 `.dev.vars` 中设置同名变量。未配置时，摘要请求返回 503；普通保存无需 AI 密钥。之前提交过的 DeepSeek 密钥必须在供应商后台撤销并替换；删除当前源码不能消除 Git 历史中的泄露。日志曾记录过的 Notion Token 也应轮换。

## 保存网页

`POST /notion/page/create`，Content-Type 为 application/json：

```json
{
  "notionApiKey": "YOUR_NOTION_TOKEN",
  "databaseId": "YOUR_DATABASE_ID",
  "url": "https://example.com",
  "needSummarize": false,
  "props": [
    { "name": "Name", "type": "title", "value": "收藏标题" },
    { "name": "URL", "type": "url" }
  ]
}
```

属性名称必须匹配实际数据库。标题 value 留空会使用网页标题。成功返回 `id`、`url`、`title`、`properties`、`summary`；客户端可用返回的页面 ID 回读验证。Jina Reader 不可用时尝试直接读取网页；两者均失败返回 502，不伪报保存成功。

使用 Notion API `2025-09-03`：单数据源数据库根据 `databaseId` 自动发现数据源。多数据源数据库必须额外传入 `dataSourceId`，否则返回 409；不会默认选择第一个。读取数据库接口保留 `object: database` 和数据库容器 `id`，另加 `data_source_id` 标识选定数据源；properties 来自该数据源。旧 databaseId 参数仍指数据库容器。

## 接口

- `GET /`、`GET /health`：JSON 存活检查，不代表 Notion/AI 可用。
- `POST /notion/page/create`：保存网页。
- `POST /notion/page/prepare`：读取网页并准备摘要，不写入 Notion。
- `POST /notion/page/retrieve`：凭 notionApiKey、pageId 读取页面。
- `POST /notion/database/retrieve`：读取选定数据源及字段。
- `POST /notion/database/query`：查询，支持 filter；沿用 Notion 分页响应。
- `POST /notion/database/retrieveAllTags`：返回多选字段中不重复的选项名称。
- `POST /notion/database/retrieveDatabaseAllArea`：读取 `🚩 领域` 关联字段，完整分页获取选项；缺少该字段返回 400。
- `POST /notion/database/retrieveDatabasePropertyDetails`：接收 propertyRequests 数组，读取字段选项。
- `POST /notion/ai`：接收 url，生成摘要，需要 AI Secret。

所有错误返回 JSON，不公开堆栈。旧 `/notion/query` 和 `/notion/pages` 网页已删除，返回 404。

参考：[Notion 数据源迁移指南](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03)。
