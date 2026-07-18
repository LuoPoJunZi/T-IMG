# Changelog

本文件记录 T-IMG 的用户可见变化和重要技术变化。日常检查与命令记录见 `docs/WORKLOG.md`。

## Unreleased

### Added

- 增加开发协作规则、项目概览、需求、计划、工作记录、技术决策和部署文档。
- 增加安全的 `.env.example` 环境变量清单。
- 增加上传、文件代理、管理认证和管理操作回归测试。
- 增加可选的 `MAX_UPLOAD_SIZE_BYTES` 上传限制配置。
- 增加仓库文件命名规范、静态路径兼容重定向及规范管理 API 路由。

### Changed

- 将 Node 测试环境与现有 Cloudflare Pages Functions 统一为 ES Modules，使原有分页测试可被 Mocha 加载。
- CI 改用 `npm ci`，按锁文件安装依赖。
- 移除外部代码同步工作流，T-IMG 作为无外部远程关联的独立仓库维护。
- 完善本地依赖、Wrangler/KV 数据、环境文件和日志的忽略规则。
- 项目品牌统一为 `T-IMG`，许可证与来源致谢在 README 中说明。
- 本地 Wrangler 命令固定兼容日期，生产 Pages 配置继续由 Cloudflare 控制台管理。
- `node_modules/` 不再由 Git 跟踪，依赖统一通过 `package-lock.json` 和 `npm ci` 恢复。
- 静态页面和资源改用语义化 kebab-case，资源归档到 `assets/images`、`assets/icons` 和 `assets/styles`；中文 README 改为 `README.zh-CN.md`。
- 管理页面改用 `/api/manage/edit-name/:id` 和 `/api/manage/toggle-like/:id`，旧驼峰路径继续兼容。

### Fixed

- 修复后台重命名读取错误参数、缺失记录异常和不完整 Basic Auth 配置处理。
- 修复管理错误响应暴露堆栈及管理路由记录环境、用户名和完整元数据的问题。
- 修复上传缺少配置/空文件/大小/文件名校验、透传 Telegram 错误及 KV 写入失败误报上传失败的问题。
- 修复文件代理向外部转发 Authorization、Cookie 等原始请求头的问题。
- 修复仅凭管理页 Referer 绕过黑白名单的问题；启用 Basic Auth 后预览必须携带有效凭据。
- 修复 Telegram 文件查询失败后继续请求无效外部地址的问题。

### Security

- 环境变量示例仅使用占位值，并默认忽略本地 `.env*` 文件（保留 `.env.example`）。
- 移除指向第三方固定 Sentry 项目的前端脚本、Functions 遥测代码、相关依赖及生成包中的百度页面追踪钩子。
- 升级到 Node.js 22、Wrangler 4 和当前测试工具，改用 Node 内置测试运行器并将 npm 安全审计降为 0 漏洞。
- GitHub Actions 在 `main` 推送、Pull Request 和手动触发时运行，官方 Action 固定到完整提交 SHA。
- 增加 `.gitattributes`、`.editorconfig`、贡献指南、安全策略和 Pull Request 模板。
- Telegram 文件不会把包含 Bot Token 的下载地址发送给第三方内容审核服务。
