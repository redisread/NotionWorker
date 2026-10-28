# NotionWorker

为快捷指令等客户端提供 Notion 网页收藏和数据库查询的纯后端 Cloudflare Worker。

生产入口：[shortcut.jiahongw.com](https://shortcut.jiahongw.com)。服务读取网页标题，将客户端指定的属性保存到 Notion，再返回页面 ID 和链接。当前不提供前端或 AI 摘要，也不把网页正文写入页面。

## 本地开发

Node.js 版本与 [CI 配置](.github/workflows/deploy_worker.yml) 保持一致；pnpm 版本以 [package.json](package.json) 的 `packageManager` 为准。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

使用开发服务器输出的地址访问 `/health`。请求实际 Notion 接口时，需要有目标数据库访问权限的 Notion Token。

提交前运行：

```sh
pnpm check
```

检查包含类型、Workers 运行时测试和部署打包。测试使用模拟上游；通过检查不等于生产 Notion 保存已验证。

## 按任务阅读

- **接入客户端、修改请求或响应**：读 [API 契约](docs/api.md)，包括参数、属性类型、数据源选择和兼容限制。
- **发布、排障、真实保存验收**：读 [运维流程](docs/operations.md)，区分构建、部署和业务验证。
- **在仓库内修改代码或文档**：遵循 [项目规则](AGENTS.md)。

依赖与脚本以 [package.json](package.json) 为准，Worker 配置以 [wrangler.toml](wrangler.toml) 为准。文档记录使用方式和维护约定，避免另存版本清单。
