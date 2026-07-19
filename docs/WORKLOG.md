# 开发工作记录

## 2026-07-18：项目标准化

### 目标

建立可长期维护的 T-IMG 基线，不实施总任务说明中的示例核心功能。

### 已完成

- 检查 Git、目录、Cloudflare Pages Functions、静态页面、环境变量、上传、文件访问、管理认证和 KV 调用链。
- 创建 `AGENTS.md`、需求、计划、项目概览、技术决策、部署说明和变更记录。
- 创建安全的 `.env.example`，完善 `.gitignore`，停止跟踪约 1,282 个 `node_modules` 文件。
- 统一 ES Modules，修复原有测试无法加载 Functions 的问题。
- 建立锁文件安装和本地 Wrangler 回归流程。
- 移除外部代码自动同步能力，T-IMG 改为独立维护。

### 基线结果

- 初始环境：Node.js `v20.15.0`、npm `10.7.0`。
- 初始测试因缺少测试运行器和模块类型不一致失败。
- 标准化后原有 2 项测试通过。

## 2026-07-18：稳定性与安全修复

### 已完成

- 项目、页面、包信息和维护文档品牌统一为 `T-IMG`。
- 移除固定 Sentry、页面追踪和相关依赖；错误响应不返回堆栈。
- 上传链路增加配置、空文件、大小、文件名、扩展名、重试和稳定错误处理。
- 默认上传限制为 20 MiB；Telegram 上传成功后 KV 写入失败不再误报整体失败。
- 修复 Basic Auth 畸形头、配置不完整、后台重命名参数、缺失记录和敏感日志问题。
- 文件代理只转发安全请求头，不把 Cookie、Authorization 或带 Token 的下载地址发送到外部服务。
- 新增上传、文件代理、管理认证和管理操作测试。

### 验证

- `npm test`：28 项通过。
- `npm run ci-test`：Wrangler 编译成功，首页返回 200。
- 运行时代码无固定遥测引用，敏感信息模式匹配为 0。

## 2026-07-18：仓库文件命名标准化

### 已完成

- 新增 `docs/REPOSITORY_CONVENTIONS.md`。
- 中文 README 规范为 `README.zh-CN.md`。
- 页面规范为 `markdown-upload.html`、`admin-gallery.html`、`image-blocked.html`、`whitelist-enabled.html`。
- 资源归档到 `assets/images/`、`assets/icons/`、`assets/styles/`。
- 管理主路由使用 `edit-name` 和 `toggle-like`；旧驼峰 API 保留兼容转发。
- 新增 `_redirects`，为 7 个旧静态路径提供 301 重定向。
- 新增仓库结构测试，固定规范文件、重定向和兼容 API。

### 验证

- `npm test`：31 项通过。
- Wrangler 成功解析 7 条重定向规则。
- README 本地链接、空白和敏感信息检查通过。

## 2026-07-18：独立公开仓库发布准备

### 已完成

- 当前工作分支切换为 `main`。
- 移除所有 Git 远程；发布时只允许把个人公开 `T-IMG` 仓库配置为 `origin`。
- 删除代码同步工作流和同步操作文档；仓库不建立 fork、额外远程或自动同步关系。
- 页面、运行代码和维护文档不再包含外部仓库关联；来源致谢和许可证入口只保留在中英文 README。
- GitHub Actions 增加 `main` 推送、Pull Request 和手动触发，权限降为只读，官方 Action 固定到完整提交 SHA。
- 增加 `.gitattributes`、`.editorconfig`、`CONTRIBUTING.md`、`SECURITY.md` 和 Pull Request 模板。
- 运行基线升级为 Node.js 22、Wrangler 4.112.0、concurrently 10.0.3 和 wait-on 9.0.10。
- 移除 Mocha，31 项测试迁移到 Node.js 内置测试运行器。

### 验证

- 临时 Node.js：`v22.23.1`，不修改系统 Node。
- `npm test`：31 项通过、0 失败。
- `npm run ci-test`：退出码 0；Wrangler 4 编译成功，首页 HEAD 返回 200，31 项测试通过，7 条重定向有效。
- npm 官方注册表安全审计：0 个已知漏洞。
- 真实 Telegram、Cloudflare KV、内容审核服务和生产 Pages 项目未使用。

### 当前状态

发布基线已提交并推送到独立公开仓库 `LuoPoJunZi/T-IMG` 的 `main`，GitHub Actions 验证通过；仓库仅配置自己的 `origin`，生产 Cloudflare 部署仍待执行。

## 2026-07-19：上传页面后端访问保护

### 目标与现状分析

- 确认 `index.html` 和 `markdown-upload.html` 原为可直接访问的静态页面，`POST /upload` 没有上传访问认证。
- 确认后台管理使用独立 Basic Auth，公开 `/file/:id` 不应受新认证影响。
- 确认 Cloudflare Pages Clean URLs 会提供 `/index`、`/markdown-upload` 等无扩展名入口，必须与 `.html` 路径同时进入 Function。
- 修改前系统 Node.js `v20.15.0` 下原有 31 项测试通过；Wrangler 4 因要求 Node.js 22 未能启动，作为环境基线记录。

### 已完成

- 新增根级 Pages Functions 中间件和 `_routes.json`，保护 `/`、`/index[.html]`、`/markdown-upload[.html]`，未认证时后端跳转 `/upload-login`。
- 新增上传密码登录页，以及登录、会话状态和退出 API；原上传页面增加后端退出表单。
- 使用 Web Crypto HMAC-SHA256 签名含签发时间、过期时间和随机数的会话令牌；Cookie 使用 `__Host-`、`HttpOnly`、`Secure`、`SameSite=Strict` 和 `Path=/`。
- `POST /upload` 再次验证上传会话并拒绝浏览器跨站请求；有效后台 Basic Auth 继续允许管理画廊批量上传。
- 新增独立 `UPLOAD_AUTH_KV`，对匿名化客户端地址记录 10 分钟窗口内的失败次数，第 5 次失败起返回 429；关键配置或限流存储不可用时失败关闭。
- 登录请求限制为 8 KiB，仅接受 JSON 或 URL 编码表单；返回路径在前后端均使用固定上传页白名单，避免开放重定向。
- 安全审查后将登录页脚本和样式移到同源静态文件，由 Function 设置严格 CSP、禁止缓存、禁止嵌入和最小权限响应头。
- 同步 `.env.example`、中英文 README、部署、项目概览、需求、计划、决策、命名规范和变更记录。

### 验证

- Node.js `v22.23.1` 下 `npm run ci-test` 退出码 0；Wrangler 4 启动本地 Pages 环境，50 项测试全部通过、0 失败。
- npm 官方注册表 `npm audit --audit-level=high`：0 个已知漏洞。
- 真实本地 HTTP 流程：五个上传页入口未认证均为 302；登录页 200；未认证 `/upload` 为 401；错误密码为 401；正确密码建立会话后上传页为 200；退出后重新为 302。
- `/file/*` 与 `/api/manage/*` 未被上传页面中间件重定向；现有文件代理和后台测试继续通过。
- 登录页实际响应包含严格 `Content-Security-Policy`、`X-Frame-Options: DENY`、`Cache-Control: private, no-store`、`Referrer-Policy: no-referrer`。
- 未调用真实 Telegram、生产 KV、内容审核服务或 Cloudflare Pages 项目。

### 当前状态

DEV-009 已通过提交 `c473b8e` 推送到独立公开仓库的 `main`，尚未部署生产。生产启用前必须在 Cloudflare 配置两个 Secret、会话时长、独立 `UPLOAD_AUTH_KV`，并把 Pages Functions 配额行为设置为 Fail closed。

## 2026-07-19：Cloudflare 上传密码配置教程

### 已完成

- 在中英文 README 增加上传访问密码快速配置入口，并在配置表逐项标明应选择文本、密钥或 KV Namespace 绑定。
- 在部署文档明确 `UPLOAD_ACCESS_PASSWORD` 是访问者实际输入的密码，`UPLOAD_SESSION_SECRET` 只是后端会话签名密钥。
- 增加 Cloudflare Variables and Secrets、Workers KV 绑定、Fail closed、重新部署及生产验收的逐步说明。
- 增加 Windows PowerShell 安全随机会话密钥生成命令，不在仓库中保存任何真实密码或密钥。

### 验证

- 教程中的变量名、最小长度、会话范围、KV 绑定名称和认证行为已与当前代码及 `.env.example` 核对。
- 文档只包含占位说明和随机生成命令，不包含生产凭据。
