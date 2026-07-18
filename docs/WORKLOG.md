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

本地 `main` 已完成发布前验证并形成独立发布基线；个人仓库配置、首次推送和部署仍待执行。首次推送后由 GitHub Actions 再执行一次云端验证。
