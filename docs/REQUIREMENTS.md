# 二次开发需求

## 项目目标

在保留现有公开路径和成功响应兼容性的前提下，建立清晰、可维护、可追踪的独立开发基线，修复已确认的安全、稳定性与接口问题，并为后续由项目所有者确认的功能需求提供规范、文档和测试基础。

## 用户场景

- 项目所有者能够从需求、计划和工作记录中了解当前基线、风险和进度。
- 后续开发者能够快速定位前端入口、Functions、环境变量、测试和部署方式。
- 独立仓库不会通过外部同步工作流覆盖已确认的项目代码。
- 本地配置示例不会诱导提交真实密钥。

## 功能需求

### DEV-001

- 需求名称：二次开发项目标准化
- 需求描述：完成仓库检查、运行基线、长期协作规则、项目概览、需求、计划、工作记录、决策、部署、环境变量示例和变更记录；不实施示例业务需求。
- 用户价值：降低长期开发中的信息丢失、误改、泄密和自动覆盖风险。
- 涉及页面：无业务页面修改。
- 涉及接口：不改变任何公开 API；仅对齐 Node 测试的 ES Module 配置。
- 配置要求：保留 Cloudflare Pages、Telegram Bot API 和 `img_url` KV；不配置外部代码同步。
- 验收标准：规范文件内容基于实际代码；`npm test` 与 `npm run ci-test` 可执行；记录原始基线失败及最终结果；无真实敏感值；Git 差异不包含业务逻辑修改。
- 优先级：高
- 状态：已完成

### DEV-002

- 需求名称：项目更名为 T-IMG
- 需求描述：将本地项目、页面标题、管理界面、包信息和维护文档中的品牌统一为 `T-IMG`，并在 README 保留必要的来源致谢和许可证入口。
- 用户价值：为后续创建名为 `T-IMG` 的 GitHub 仓库和独立发布建立一致身份。
- 涉及页面：首页、管理页、拦截提示页、白名单提示页、README。
- 涉及接口：不改变 API 路径和返回格式。
- 配置要求：Cloudflare/Wrangler 项目标识使用合法的小写名称 `t-img`；GitHub 仓库显示名称使用 `T-IMG`。
- 验收标准：用户可见品牌显示为 `T-IMG`；运行页面与维护文档不建立外部仓库关联；README 保留一次清晰致谢和许可证入口。
- 优先级：高
- 状态：已完成

### DEV-003

- 需求名称：依赖与运行基线治理
- 需求描述：停止跟踪 `node_modules`，保留锁文件安装；固定本地 Wrangler 兼容日期；让 CI 和本地测试保持可复现。
- 用户价值：减少跨平台巨大差异，避免本地运行时随日期漂移。
- 涉及页面：无。
- 涉及接口：无。
- 配置要求：使用 `npm ci`；Cloudflare 生产控制台仍是生产配置来源。
- 验收标准：Git 不再跟踪依赖目录；`npm ci`、`npm test`、`npm run ci-test` 可运行；本地 Wrangler 不再提示缺少兼容日期。
- 优先级：高
- 状态：已完成

### DEV-004

- 需求名称：上传链路安全与稳定性修复
- 需求描述：校验必需配置、空文件、文件大小、文件名和扩展名；不向客户端透传 Telegram 内部错误；Telegram 成功后 KV 写入失败不得误报上传失败。
- 用户价值：失败原因更清晰，减少无效外部请求、敏感信息暴露和重复上传风险。
- 涉及页面：首页及管理页上传调用方（保持现有交互）。
- 涉及接口：`POST /upload`，成功响应格式保持不变；错误响应使用稳定 JSON 信息和更准确状态码。
- 配置要求：`TG_Bot_Token`、`TG_Chat_ID` 和 KV Namespace 绑定 `img_url` 必需；默认最大 20 MiB，可用 `MAX_UPLOAD_SIZE_BYTES` 向下调整，确保上传内容可由公共 Bot API 的 `getFile` 链路取回。
- 验收标准：正常、空文件、超限、缺失配置、Telegram 失败、网络异常及 KV 失败均有回归测试；不使用真实 Telegram。
- 优先级：高
- 状态：已完成

### DEV-005

- 需求名称：管理接口正确性与信息泄露修复
- 需求描述：修复重命名参数读取，处理缺失 KV 记录和畸形 Basic Auth，不向客户端返回堆栈，不记录环境对象、用户名或完整元数据。
- 用户价值：后台操作结果可靠，错误可控，凭据和内部结构不会进入日志或响应。
- 涉及页面：`admin-gallery.html` 的重命名操作。
- 涉及接口：现有 `/api/manage/*` 路径和调用方式保持兼容。
- 配置要求：生产后台同时配置 `BASIC_USER` 与 `BASIC_PASS`，或由 Cloudflare Access 完整保护。
- 验收标准：认证失败、配置不完整、记录不存在、重命名成功及非法名称均有测试；响应不含堆栈或环境内容。
- 优先级：高
- 状态：已完成

### DEV-006

- 需求名称：文件代理与遥测隐私修复
- 需求描述：不再默认向第三方固定 Sentry 项目发送请求信息；文件代理只转发必要的安全请求头；清理文件 ID、外部路径、审核结果和响应对象日志；Telegram 路径查询失败时返回可控错误。
- 用户价值：避免 Basic Auth、Cookie、文件标识和审核数据泄露，降低代理异常风险。
- 涉及页面：文件访问和管理预览行为保持兼容。
- 涉及接口：`/file/:id` 路径不变。
- 配置要求：移除已废弃的 `disable_telemetry`、`sampleRate` 说明及 Sentry 依赖。
- 验收标准：代理头白名单、Telegram 查询失败、异常中间件和无遥测依赖均经过测试或静态验证。
- 优先级：高
- 状态：已完成

### DEV-007

- 需求名称：仓库文件与命名标准化
- 需求描述：统一源码、静态页面、资源、测试和区域化文档的命名规则，整理静态资源目录；公开静态路径保留重定向，已发布管理 API 保留兼容入口。
- 用户价值：文件用途更易识别，降低查找、引用和长期维护成本，同时避免已部署链接突然失效。
- 涉及页面：上传页、管理页、拦截页、白名单页及中英文 README。
- 涉及接口：规范管理路由使用 `/api/manage/edit-name/:id` 和 `/api/manage/toggle-like/:id`；旧驼峰路径继续兼容。
- 配置要求：Cloudflare Pages 读取根目录 `_redirects`；不改变 Telegram、KV 或认证变量。
- 验收标准：命名规范有文档；新名称引用完整；旧静态路径有重定向；旧 API 有兼容实现；README 与项目概览同步；完整测试和引用扫描通过。
- 优先级：高
- 状态：已完成

### DEV-008

- 需求名称：独立公开仓库发布准备
- 需求描述：将 T-IMG 调整为独立公开仓库，使用 `main` 默认分支，不建立 fork、额外代码远程或同步工作流；升级运行基线、CI、安全和贡献文档。
- 用户价值：首次公开推送不会误写其他仓库，自动化测试覆盖 `main`，依赖与协作入口符合公开维护要求。
- 涉及页面：中英文 README 和页面来源链接。
- 涉及接口：不改变业务 API；测试运行器由 Mocha 迁移到 Node 内置测试。
- 配置要求：Node.js 22；GitHub Actions 只读权限；个人公开仓库是唯一 `origin`。
- 验收标准：本地分支为 `main`；无外部 Git 远程；同步工作流已删除；npm 审计 0 漏洞；31 项测试和 Wrangler 4 回归通过；来源致谢只存在于 README。
- 优先级：高
- 状态：已完成

### DEV-009

- 需求名称：上传页面后端访问保护
- 需求描述：访问主上传页或 Markdown 上传页前必须通过后端密码验证；使用 HMAC 签名的安全 Cookie 保持会话；页面和 `POST /upload` 双重校验；提供退出能力。最初的连续失败限制后由 DEV-013 简化为不记录错误次数。
- 用户价值：防止未授权访客看到上传界面或绕过页面直接消耗 Telegram、Cloudflare 和项目配额。
- 涉及页面：`index.html`、`markdown-upload.html`、新增 `upload-login.html`，同时保护 Pages Clean URLs 的 `/index` 和 `/markdown-upload` 等价路径。
- 涉及接口：新增 `POST /api/upload-auth/login`、`POST /api/upload-auth/logout`、`GET /api/upload-auth/session`；`POST /upload` 成功响应保持不变，未认证返回 401，跨站请求返回 403，配置缺失返回 503。
- 配置要求：`UPLOAD_ACCESS_PASSWORD` 代码最低 12 字符、生产建议至少 24 个随机字符；`UPLOAD_SESSION_SECRET` 至少 32 字符，二者保存为不同的 Cloudflare Secret；`UPLOAD_SESSION_MAX_AGE` 默认 604800 秒；Pages Functions 配额设置为 Fail closed；不需要认证 KV。
- 兼容要求：`/file/:id` 继续公开；后台管理认证与路由不改变；有效后台 Basic Auth 可继续调用 `/upload`，保持画廊批量上传。
- 验收标准：未认证页面跳转登录、未认证接口返回 401、正确/错误密码、刷新保持、篡改/过期会话、退出、重复错误仍统一拒绝、跨站请求、Clean URLs、公开文件和后台路由均有自动化或真实 HTTP 验证；仓库无真实密码。
- 优先级：高
- 状态：已完成

### DEV-010

- 需求名称：上传配置契约与生产诊断修复
- 需求描述：将 `img_url` 恢复为生产上传必需的 KV Namespace 绑定；在联系 Telegram 前校验 Telegram 字符串配置和 KV 方法；日志仅记录缺失配置名称；上传页针对会话过期、文件超限、服务配置和上游故障提供可操作反馈；CI 通过本地 Wrangler 的真实 HTTP 路由回归认证流程。
- 用户价值：避免产生没有索引记录的新上传，阻止把文本变量误当 KV，缩短生产配置故障定位时间，并防止单元测试全绿却遗漏 Pages 路由问题。
- 涉及页面：`index.html`、`markdown-upload.html` 及同源上传反馈脚本。
- 涉及接口：`POST /upload` 新增 `image_index_not_configured` 503 错误码；成功响应、公开 `/file/:id` 和后台路由保持兼容。
- 配置要求：Production 环境必须分别配置 `TG_Bot_Token`、`TG_Chat_ID`、`img_url` 和两个上传认证 Secret；`img_url` 必须是 KV Namespace 绑定，不能是文本或 Secret。
- 验收标准：缺失、文本或不完整 `img_url` 在 Telegram 调用前被拒绝；日志不含配置值；已有公开文件在 KV 绑定异常时仍可访问；前端显示安全且可操作的错误；`npm test` 与真实 Pages HTTP 冒烟测试覆盖修复行为。
- 优先级：高
- 状态：已完成

### DEV-011

- 需求名称：自动短链与 KV 配额优化
- 需求描述：新上传由后端自动生成短码并返回 `/i/{short-code}.{extension}`；复用现有 `img_url`，在同一 KV 记录中保存完整 Telegram `file_id` 和管理元数据；不增加短链专用 KV，不提供自定义命名。
- 用户价值：显著缩短公开图片地址，同时避免新增命名空间和不必要的 KV 读取、写入消耗。
- 涉及页面：原上传、拖拽、进度和结果展示页面不改变交互；后台现有 `/file/:id` 预览保持兼容。
- 涉及接口：`POST /upload` 成功响应仍为包含 `src` 的数组，新上传在 KV 写入成功时返回 `/i/:short-code.ext`；新增公开 `GET|HEAD /i/:short-code.ext`；旧 `/file/:id` 保持公开兼容。
- 数据要求：短码为后端使用 Web Crypto 自动生成的 12 位 URL 安全随机值；KV 键为短码和安全扩展名，元数据新增 `telegramFileId`；不保存自定义别名。
- 配额要求：生成短码不执行碰撞查询；普通 `/i/` 请求只读取一次 `img_url` 记录并且不写回未变化元数据；上传认证不读写错误次数 KV。
- 故障处理：短码记录不存在时返回 404；短链依赖的 KV 不可用时返回不泄密的 503；Telegram 已成功但 KV 写入失败时返回可直接解析的旧式 `/file/{file_id}.{extension}` 地址。
- 验收标准：短码格式、完整 Telegram 标识保存、单次 KV 读取、零无效元数据写回、缺失映射、KV 不可用、旧链接和后台预览兼容均有回归测试；不调用真实 Telegram 或生产 KV。
- 优先级：高
- 状态：已完成

### DEV-012

- 需求名称：个人博客发布文章
- 需求描述：基于当前代码和维护文档，整理一篇可直接用于个人博客的中文 Markdown 长文，完整介绍项目背景、能力、架构、认证、上传、短链、Cloudflare 配置、从零部署、测试、排错、配额、回退和限制；部署教程需要覆盖 GitHub、Telegram Bot/Chat ID、唯一必需的 `img_url` KV、Pages 构建参数、Production 变量与 Secret、强密码生成、Fail closed、重新部署和首次验收。
- 用户价值：无需重新拼接仓库说明即可对外介绍 T-IMG，并为读者提供从理解原理到完成部署的连贯资料。
- 涉及页面与接口：不修改运行页面、Functions 或公开 API。
- 安全要求：只使用占位凭据和示例短码，不包含真实 Token、Chat ID、密码、Cookie 或 Authorization Header；项目来源致谢仍只维护在中英文 README。
- 验收标准：文档使用标准 Markdown，包含文章元数据、架构图、配置表、可由首次部署者逐项执行的详细部署步骤、强密码生成、验收清单和错误排查；明确可自定义的 KV 资源名与必须严格匹配的绑定名，区分 Text、Secret、KV binding 及 Production、Preview；事实与当前 Unreleased 版本及现有文档一致；相对仓库之外仍可阅读主要内容。
- 优先级：中
- 状态：已完成

### DEV-013

- 需求名称：简化上传认证存储并移除错误次数记录
- 需求描述：取消 `UPLOAD_AUTH_KV`、登录失败计数和递增等待时间；没有正确密码时始终由后端拒绝，不创建会话；正确密码、签名 Cookie、上传页面和接口双重校验、退出及原上传能力保持不变。
- 用户价值：减少一个 KV Namespace、认证读写和部署步骤，符合个人站点“强密码即可上传”的简化使用方式。
- 涉及页面：登录页错误提示移除 429 分支；原上传页面、拖拽、进度和结果展示不变。
- 涉及接口：`POST /api/upload-auth/login` 错误密码统一返回 401 `invalid_credentials`；不再返回登录限流相关 429 或因认证 KV 缺失导致的 503。其他认证、上传和公开文件路由保持兼容。
- 配置要求：不再绑定 `UPLOAD_AUTH_KV`；`UPLOAD_ACCESS_PASSWORD` 与 `UPLOAD_SESSION_SECRET` 必须分别保存为 Cloudflare Secret；生产访问密码建议由密码学安全随机源生成至少 24 个随机字符；唯一必需 KV 仍为 `img_url`。
- 安全要求：密码只在后端校验，日志不记录输入值；Cookie 属性、同源检查、请求大小和类型限制及 Fail closed 均保留。错误尝试仍会消耗 Pages Functions 请求，高风险部署可在自定义域名叠加 Cloudflare 边缘防护。
- 验收标准：无 `UPLOAD_AUTH_KV` 时正确登录、会话和退出正常；连续错误密码始终返回 401 且没有 Cookie；未认证直接上传被拒绝；完整测试通过；README、博客、部署、配置示例和维护文档一致并包含强密码生成教程。
- 优先级：高
- 状态：已完成

### DEV-014

- 需求名称：补充自定义域名与 Cloudflare WAF 人机验证教程
- 需求描述：在中英文 README、部署指南和博客中增加自定义域名绑定、DNS 代理、`*.pages.dev` 防旁路、WAF Managed Challenge、Challenge Passage、可选 Rate Limiting/Bot Fight Mode、验收与回退说明。
- 用户价值：无需重新引入认证 KV，即可在 Cloudflare 边缘减少自动化密码提交和无效 Functions 请求，同时保持公开图片链接可匿名引用。
- 涉及页面与接口：不修改项目运行代码；推荐 WAF 匹配 `/upload-login`、`/upload-login/`、`/upload-login.html` 和 `POST /api/upload-auth/login[/]`，不匹配 `/i/*`、`/file/*`、静态资源、会话 API 或默认 `POST /upload`。
- 配置要求：自定义域名必须先在 Pages 项目中激活并由 Cloudflare 区域代理；生产 `*.pages.dev` 通过 Bulk Redirect 跳转自定义域名；WAF 动作为 Managed Challenge；Challenge Passage 建议先使用 30 分钟。
- 安全要求：WAF 不替代 `UPLOAD_ACCESS_PASSWORD`、签名 Cookie、上传接口二次校验、Fail closed 或后台 Basic Auth；文档不得要求公开凭据、Cookie 或 Token。
- 兼容要求：公开 `/i/*`、`/file/*`、拖拽上传、进度、后台和旧链接行为不变；启用 Bot Fight Mode、全站质询或管理 API 质询时必须明确误伤和自动化客户端风险。
- 验收标准：教程提供可复制的主机名与路径表达式、控制台路径、`pages.dev` 防旁路、Cookie 分层、Security Events 排错、验收和回退步骤；事实与 Cloudflare 当前官方文档核对；仓库代码、依赖和云端资源不变。
- 优先级：高
- 状态：已完成

### DEV-015

- 需求名称：修复 GitHub Actions 开发依赖审计阻断
- 需求描述：解决新 npm 安全公告导致 CI 在测试前退出的问题；修复已有兼容安全版本的直接开发工具链，同时让暂时只能等待上游的 Wrangler/Miniflare 公告保持可见但不跳过功能测试。
- 用户价值：GitHub Actions 能继续验证真实 Pages 路由和回归测试，不会因无法由 T-IMG 自身修复的纯开发工具公告持续报红，也不会把公告完全隐藏。
- 涉及运行代码与接口：不修改 Pages Functions、页面、公开路由、响应或 Cloudflare 生产配置。
- 依赖要求：`concurrently` 使用包含安全 `shell-quote` 的 9.2.4；不得为清零审计报告强制降级 Wrangler Runtime 或覆盖 Cloudflare 未验证的 Miniflare/Sharp 组合。
- CI 要求：生产依赖高危审计继续阻断；完整开发依赖审计必须运行并显示上游公告，但不阻止 `npm run ci-test`；安装继续使用锁文件和 `npm ci`。
- 验收标准：生产依赖审计返回 0；`shell-quote` 漏洞不再出现；剩余公告仅来自 Wrangler 开发工具链；单元测试和 Pages HTTP 回归通过；新一轮 GitHub Actions 总体成功且仍显示开发审计告警。
- 优先级：高
- 状态：已完成

## 非功能需求

- 安全优先于兼容、功能、维护性和界面美观。
- 所有改动小步、可验证、可回滚并有中文记录。
- 保持 Cloudflare Pages Functions/Workers Runtime 兼容。
- 新依赖必须说明必要性；本次不新增依赖。
- 后续功能必须提供自动化测试或明确的手工验证。

## 兼容性要求

- 保留现有静态页面路径、Functions 路由、HTTP 方法和成功响应结构；认证失败可返回 401、403 或配置缺失时的 503。
- 保留 Telegram 上传、同域 `/file/` 公开访问、必需的 `img_url` KV 索引与管理和 Cloudflare Pages 部署方式；新增 `/i/` 不替换或迁移旧链接。
- 不把项目迁移到新前端框架，不更换存储或现有后台认证架构。

## 安全要求

- 不提交 Telegram Token、Chat ID、管理密码、审核 API Key、Cloudflare 凭据、Cookie 或 Authorization Header。
- 示例配置只使用占位值；本地 `.env*` 文件默认忽略，仅跟踪 `.env.example`。
- 错误、遥测和日志中的敏感信息不得暴露凭据、请求头、文件标识、环境对象或堆栈，并需由回归测试或静态检查验证。
- 上传密码只在后端校验；会话 Cookie 必须使用 `HttpOnly`、`Secure`、`SameSite=Strict` 和 `__Host-` 约束；浏览器状态不得依赖 localStorage。

## 非目标

- DEV-009 不重设计原有上传、拖拽、进度或结果展示交互，只新增认证入口和退出按钮。
- DEV-009 不把已上传文件改为私有，不修改 `/file/:id` 的公开访问语义。
- DEV-011 不提供用户自定义短码、旧记录批量迁移或新的 KV 命名空间。
- DEV-012 不修改业务代码、云端配置或生产环境。
- DEV-013 不提供应用内错误次数记录、递增等待或登录限流。
- DEV-014 不把嵌入式 Turnstile 控件加入页面，不替用户创建域名、WAF、Rate Limiting、Access 或其他生产资源。
- 不更换 Telegram 与图片元数据 KV 存储架构，不替换现有后台 Basic Auth。
- 本轮不创建或修改生产 Cloudflare 资源，不部署生产环境；生产 Secret 和 KV 绑定由项目所有者配置。

## 待确认事项

- 原总任务说明中的其他示例功能仍不进入开发清单；只实施项目所有者单独确认的正式需求。
- 生产域名、Cloudflare Pages 项目、WAF/重定向、`img_url`、真实 Telegram/KV/内容审核联调仍待项目所有者配置和隔离验证。
