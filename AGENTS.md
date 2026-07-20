# T-IMG 二次开发协作规则

本文件适用于仓库全部目录。后续 Codex 或其他自动化开发工具在修改本项目时，必须先阅读本文件及相关需求、计划和工作记录。

## 项目说明

- 项目名称：T-IMG；未来 GitHub 仓库名称固定为 `T-IMG`。
- 项目用途：提供基于 Cloudflare Pages Functions、Telegram Bot API 和必需 `img_url` KV 元数据绑定的文件上传、访问及图片管理能力。
- 维护定位：T-IMG 是独立公开仓库，不建立 fork、外部远程或自动代码同步关系；在项目所有者确认需求后进行小步、可验证的长期开发。
- 当前目标：修复已确认的本地稳定性与安全问题；未经确认不得把总任务文档中的示例功能当作待开发事项。
- 主要平台：Cloudflare Pages、Pages Functions、Workers Runtime、Cloudflare KV、Telegram Bot API。
- 静态入口：`index.html`、`markdown-upload.html`；上传验证入口为 `upload-login.html`；管理入口包括 `admin.html`、`admin-gallery.html` 和 `admin-waterfall.html`。
- 后端目录：`functions/`；测试目录：`test/`；CI 配置：`.github/workflows/`。
- 核心入口：`functions/_middleware.js`、`functions/upload.js`、`functions/i/[id].js`、`functions/file/[id].js`、`functions/api/upload-auth/`、`functions/api/manage/`、`functions/utils/middleware.js`。
- 核心 API：`POST /upload`、`/i/:short-code.ext`、`/file/:id`、`/api/upload-auth/{login|logout|session}`、`/api/manage/list`、`/api/manage/check`、`/api/manage/login`、`/api/manage/logout`、`/api/manage/{block|white|delete|toggle-like|edit-name}/:id`；旧驼峰路由仅作为兼容入口保留。

## 开发原则

1. 修改前阅读相关页面、Functions、调用方、测试和文档，确认真实入口与数据流。
2. 采用最小改动原则，不做与需求无关的重构、格式化或依赖升级。
3. 未经明确需求，不改变公开路径、HTTP 方法、状态码语义、JSON 字段、文件 URL 或现有配置名称。
4. 保留并遵守 `LICENSE`；项目来源致谢只维护在中英文 README，不在页面、运行代码或其他维护文档中建立仓库关联。
5. 保持 Cloudflare Pages Functions/Workers Runtime 兼容，优先使用 Web Platform API；不得默认使用 `fs`、`net`、`child_process` 或本地持久化。
6. 不覆盖或重置用户已有修改。开始工作时检查 `git status`、当前分支、远程和基线提交。
7. 未经明确授权，不修改远程、不推送、不发布 Release、不创建云资源、不部署生产环境。
8. 新增依赖前说明必要性、体积、维护风险及 Cloudflare Runtime 兼容性。
9. 不在源码、文档、测试、日志、工作流或提交信息中写入 Token、Chat ID、密码、Cookie、Authorization Header、API Key 等真实敏感值。
10. 错误响应和日志必须避免暴露密钥、完整外部服务敏感 URL、内部响应或认证信息。
11. 新增文件必须遵循 `docs/REPOSITORY_CONVENTIONS.md`；框架保留名、公开兼容入口和生成产物不得擅自重命名。

## 文档规则

每次完成开发任务后同步更新：

- `docs/WORKLOG.md`
- `docs/DEVELOPMENT_PLAN.md`
- `CHANGELOG.md`（仅用户可见或重要技术变化）

发生重要架构或兼容性决策时更新 `docs/DECISIONS.md`；环境变量或部署方式变化时同时更新 `.env.example` 和 `docs/DEPLOYMENT.md`；需求范围或状态变化时更新 `docs/REQUIREMENTS.md`。

## 语言规则

- 与项目所有者沟通及面向所有者的工作记录使用中文。
- 代码变量、函数和文件名优先使用清晰英文。
- 注释只解释必要的设计原因，不复述代码。
- UI 语言按已确认需求处理。
- 错误信息应清晰、可操作且不泄露敏感配置。

## 测试规则

1. 修改前记录基线命令、环境版本和原有失败；不要把原有问题归因于新改动。
2. 修改后运行最相关测试，完成阶段任务后运行 `npm test`；涉及本地 Pages Functions 时运行 `npm run ci-test`。
3. 新功能增加自动化测试或明确的手工验证步骤；修复 Bug 时尽量增加回归测试。
4. 外部 Telegram、Cloudflare KV 和审核服务使用 Mock 或可控环境验证，不向真实频道发送测试文件。
5. 不删除失败测试、不降低断言强度、不用固定等待掩盖异步问题。
6. 无法测试的内容必须说明原因、已完成的替代验证及生产验证步骤。

## 完成标准

任务只有在以下条件同时满足时才算完成：功能或文档目标已实现；没有明显破坏原功能；已执行相关测试或如实记录限制；需求、计划、工作记录及相关文档已同步；未引入敏感信息；最终报告列出修改文件、测试结果、配置变化和已知问题。
