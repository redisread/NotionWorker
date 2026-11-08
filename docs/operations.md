# 运维流程

用于发布、线上排障和真实保存验收。开发入口见 [README](../README.md)，请求格式见 [API 契约](api.md)。

## 验证层级

按任务需要推进，每层用自己的证据判断完成：

1. **构建**：执行 `pnpm check`，类型、模拟上游的 Workers 测试和 dry-run 全部通过。纯文档改动在本地核对链接与内容即可，CI 仍按工作流运行。
2. **部署**：在 Cloudflare Workers Builds 中确认目标提交 SHA、构建检查和部署结果，再核对 Worker 当前生产版本。GitHub 的检查结果用于评估提交质量。
3. **存活**：访问生产 `/health`，确认 HTTP 200、JSON 内容为 `{ "status": "ok" }`。只看状态码不足以区分旧版 HTML 错误页。
4. **业务**：需要真实保存验收时，在用户授权的数据库创建明显标注的测试记录。通过返回 id 调用页面读取接口，确认标题、URL 和目标父数据源一致，才可报告保存成功。记录核验结果与测试页面链接。

文档改动不需要重复创建真实记录。曾经成功的业务验证不能替代后续部署的检查。

## 发布路径

生产地址以 [README](../README.md) 为入口，Worker 名称和运行时配置以 [wrangler.toml](../wrangler.toml) 为准。

PR 和 main 的检查由 [GitHub 工作流](../.github/workflows/check.yml) 执行。main 更新触发 Cloudflare Workers Builds，构建命令先完成检查，随后部署到生产。PR 分支仅运行 GitHub 检查。

### Workers Builds 配置

在现有 notion-worker 的 Settings → Builds 连接仓库，按下表核对配置。

| 设置 | 值 |
| --- | --- |
| Git 仓库 | redisread/NotionWorker |
| 生产分支 | main |
| 根目录 | 仓库根目录 |
| 构建命令 | pnpm check |
| 部署命令 | pnpm run deploy |
| 非生产分支构建 / PR 预览 | 关闭 |

Node.js 与 GitHub 工作流的版本保持一致，pnpm 使用 package.json 的 packageManager 版本。必要时通过构建环境的 NODE_VERSION、PNPM_VERSION 固定对应版本。安装依赖使用仓库中的 pnpm-lock.yaml。

Workers Builds 随生产分支更新独立运行。这里选择在 Cloudflare 再执行 pnpm check，确保生产发布由本次构建的检查结果控制。GitHub 中的 check 继续用于 PR 审查与 main 提交验证。[Cloudflare 构建配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

Cloudflare 构建连接和部署凭据在 Cloudflare 管理。GitHub 检查工作流仅使用 contents: read 权限。历史 CF_API_TOKEN、CF_ACCOUNT_ID 仓库 Secrets 可在切换验收完成后清理。

### 切换验收

1. 在 Cloudflare 完成上述 Git 连接，确认生产分支、命令和非生产分支设置。
2. 合并移除 GitHub 部署任务的 PR，记录合并 SHA。
3. 在 Workers Builds 确认该 SHA 完成 pnpm check 和部署，核对 Worker 当前生产版本。
4. 检查 GitHub 运行仅含 check，并按验证层级执行生产健康检查。

以两侧对应提交的实际结果确认切换完成。构建配置的管理权限与 Worker 部署权限需分别核对，Builds API 需要 Workers Builds Configuration Edit 权限。[Builds API](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/)

后续需要恢复发布时，先处理失败的构建并在 Cloudflare 重试。紧急恢复可使用 Cloudflare 的版本回滚，随后将对应修复或回退提交合入 main，使源码与生产状态重新一致。

需要本地诊断打包或按任务要求手动部署时，显式调用项目脚本：

```sh
pnpm run deploy --dry-run
# 确认目标账户、Worker 和远端配置后才执行实际发布
pnpm run deploy
```

`run` 必须保留：`pnpm deploy` 是 pnpm 内置的工作区部署命令，不会调用这里的 Wrangler 脚本。执行前通过当前登录身份核对目标账户，并检查远端变量、绑定和路由与本地配置的差异。

## 排障顺序

| 现象 | 下一步与完成条件 |
| --- | --- |
| GitHub 或 Cloudflare 安装/检查失败 | 读取失败步骤，区分依赖安装、类型、测试、打包；针对原因修复并重跑到通过。 |
| ERR_PNPM_CANNOT_DEPLOY | 核对是否显式使用 pnpm run deploy；以进入 Wrangler 且 dry-run 成功为修复证据。 |
| Cloudflare 管理 API 401/403 | 核对所选凭据、目标账户和该操作的权限。已有 OAuth 与环境变量 API Token 可能属于不同授权范围。 |
| `/health` 正常但保存失败 | 按 HTTP 状态排查参数、Notion 授权、数据源及网页抓取；以真实回读成功为业务恢复证据。 |
| Jina 429 | 当前实现会尝试直接读取网页；若最终仍为 502，再确认目标网页是否可读取。 |
| 创建请求没有收到响应 | 先核对 Notion 中是否已出现该测试标题/URL，避免直接重发创建请求。 |

## 凭据处置

凭据使用规则见 [AGENTS.md](../AGENTS.md#凭据与测试)。线上 Token 按请求传递，调用方应使用具备目标资源权限的 Notion 集成；页面准备接口不是权限检查。

AI 已移除，不需要配置 AI Secret。历史源码中的 DeepSeek 密钥及曾进入日志的 Notion Token 应由所有者在对应平台撤销或轮换；删除源码不能撤回历史泄露。未核实撤销结果时，交付中保持“待所有者处理”，不将代码清理等同于密钥已撤销。
