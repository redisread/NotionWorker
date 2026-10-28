# API 契约

供客户端接入及接口变更时使用。实现依据：[请求校验](../src/index.ts)、[页面路由](../src/routes/page.ts)、[数据库路由](../src/routes/database.ts)、[Notion 服务](../src/services/notion.service.ts)。

## 公共请求与标识

POST 请求使用 `Content-Type: application/json`，字段名区分大小写。

- `notionApiKey`：每次请求携带的 Notion Token。资源权限由 Notion 校验；Worker 没有独立的登录会话。
- `databaseId`：数据库容器 ID，用于除页面读取以外的现有 POST 接口。
- `dataSourceId`：可选，选择容器内的数据源。只有一个数据源时自动发现；多个数据源时必须指定。指定值须属于该数据库。
- `pageId`：页面读取使用，替代 `databaseId`。页面和数据库 ID 接受 32 位十六进制或带连字符的 UUID。

数据库读取响应保留 `object: "database"` 和容器 `id`，另以 `data_source_id` 返回选定数据源；`properties` 来自该数据源。这是 Worker 的兼容视图，不是原样转发 Notion 数据库容器响应。后续请求的 `databaseId` 继续使用容器 ID。

## 保存与读取页面

### POST /notion/page/create

提供公共参数，以及 `url` 和 `props`。url 必须是无用户名密码的 HTTP(S) 地址；props 中的 name 必须匹配数据库实际字段。

以下 ID 和 Token 均为占位符，调用前替换：

```json
{
  "notionApiKey": "YOUR_NOTION_TOKEN",
  "databaseId": "11111111-1111-1111-1111-111111111111",
  "url": "https://example.com",
  "props": [
    { "name": "Name", "type": "title", "value": "收藏标题" },
    { "name": "URL", "type": "url" },
    { "name": "标签", "type": "multi_select", "value": ["参考", "工具"] }
  ]
}
```

| props.type | value 与行为 |
| --- | --- |
| title | 字符串；省略或空字符串使用网页标题。客户端仍需提供该属性项。 |
| url | 字符串；省略或空字符串使用请求的 url。 |
| select | 非空字符串，作为选项名。 |
| multi_select | 字符串数组或换行分隔的字符串；去除首尾空白、空项与重复项。 |
| rich_text | 非空字符串，写入文本属性。 |

除 title、url 外，空值属性项会被跳过。当前写入范围是上述五种类型；relation 等字段的读取能力不代表支持写入。实际属性类型及内容限制仍由 Notion 校验。

成功返回 HTTP 200，包含 `id`、Notion 页面 `url`、网页 `title` 和实际提交的 `properties`。响应的 title 是抓取到的网页标题；用户指定的收藏标题以 properties 中的 title 属性为准。页面不包含网页正文或生成的摘要。

保存前始终读取网页，即使已手动提供标题。通常先请求 Jina Reader，失败或响应不合用时直接读取网页；URL 包含 `jike` 时直接读取。可用抓取路径均失败则返回 502，不创建页面。

当前没有幂等键。创建请求超时或连接中断时，先查询是否已写入，再决定是否重试，避免产生重复收藏。

### POST /notion/page/prepare

沿用 create 的请求校验，仍需 notionApiKey、databaseId、url 和 props（可为空数组）。仅抓取并返回 `{ "title": "网页标题" }`；不调用 Notion，也不验证 Token 对目标数据库的实际权限。

### POST /notion/page/retrieve

请求包含 notionApiKey 和 pageId；返回 Notion 页面对象。适合按 create 返回的 id 回读，核对父数据源和属性。

## 数据库接口

以下接口使用公共 notionApiKey、databaseId 和可选 dataSourceId。

| POST 路径 | 附加参数 | 返回与限制 |
| --- | --- | --- |
| /notion/database/retrieve | 无 | 上述数据库兼容视图，包含字段定义。 |
| /notion/database/query | 可选 filter | Notion 查询响应，含 results、has_more、next_cursor。当前只请求一页，尚未透传 start_cursor、page_size 或 sorts，不能通过此接口续查下一页。 |
| /notion/database/retrieveAllTags | 无 | 所有 multi_select 字段的去重选项名数组；不是页面中已使用标签的统计。 |
| /notion/database/retrieveDatabaseAllArea | 无 | 读取固定名称 `🚩 领域` 的 relation 属性，返回 `{ id, name }[]`；缺少该字段或类型不符返回 400。 |
| /notion/database/retrieveDatabasePropertyDetails | propertyRequests 数组 | 返回 `{ databaseId, properties }`，按字段名索引详情。 |

propertyRequests 项格式为 `{ "name": "标签", "type": "multi_select" }`；type 可省略，提供时必须匹配字段定义。select、multi_select 和 relation 会附带 options。relation 选项读取完整分页并排除无标题页面；这与 query 接口只取一页的行为不同。

## 健康检查与错误

`GET /` 返回服务标识及状态；`GET /health` 返回 `{ "status": "ok" }`。两者只证明 Worker 可响应，不验证 Notion 权限或网页抓取。

应用错误为 JSON：`{ "error": "说明" }`，不返回上游原始错误或堆栈。Cloudflare 拦截或网络故障可能发生在应用之外。

| HTTP 状态 | 主要含义 |
| --- | --- |
| 400 | JSON、参数或属性不符合要求。 |
| 401 / 403 | Notion 凭据无效或资源访问受限。 |
| 404 | 接口不存在，或 Notion 资源不存在/未授权。 |
| 409 | 数据源不能唯一确定，需提供 dataSourceId。 |
| 429 | Notion 限流。 |
| 502 | 网页抓取或未单独映射的上游请求失败。 |

## 已移除能力

`/notion/query`、`/notion/pages` 和 `/notion/ai` 返回 JSON 404。create/prepare 可省略 needSummarize；保留旧客户端的 false 值，true 返回 400。create 响应不含 summary，prepare 只返回 title。
