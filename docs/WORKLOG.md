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

## 2026-07-19：上传配置契约与生产诊断修复

### 问题确认

- 生产截图与现有代码对照后确认：`img_url` 原本是上传索引、公开文件元数据检查和后台管理共同依赖的 KV Namespace 绑定，不应被当作可选变量。
- 原上传接口只校验 Telegram 变量，缺失或把 `img_url` 错配成文本时仍可能先向 Telegram 发送文件；上传页又只显示通用错误，无法区分认证、配置和上游故障。
- 原 `ci-test` 等待本地端口后仅重复单元测试，没有通过真实 Pages 路由验证页面跳转、登录 Cookie、接口认证与退出流程。

### 已完成

- `POST /upload` 在联系 Telegram 前校验 `TG_Bot_Token`、`TG_Chat_ID` 和 `img_url.put`；缺失或错误类型返回稳定 503 错误码，日志只列配置名称，不输出值。
- `img_url` 恢复为生产必需的 KV Namespace 绑定；后台同时校验管理所需 KV 方法，避免文本变量通过真值判断后触发运行时异常。
- 保留既有公开文件可用性：文件代理遇到 `img_url` 缺失或类型错误时继续提供 Telegram 文件，不把配置故障扩大为已有公开链接中断。
- Telegram 已接收文件后若发生瞬时 KV 写入失败，继续返回兼容成功结果并记录安全警告，避免用户重试产生重复文件；上传前的绑定错误则失败关闭。
- 两个上传页面加载同源错误反馈脚本，针对会话过期、文件超限、缺失配置、Telegram 和网络故障显示安全且可操作的中文提示，不展示后端原始错误内容。
- `ci-test` 通过本地 Wrangler 的真实 HTTP 路由验证未认证页面、未认证上传、登录、受保护页面、配置前置校验和退出；未增加第三方依赖。
- 同步中英文 README、环境配置示例、部署、项目概览、需求、计划、决策和变更记录。

### 验证

- 系统 Node.js `v20.15.0` 下首次受限沙箱运行因测试运行器无法创建子进程而报 `spawn EPERM`；允许创建本地子进程后，`npm test` 为 57 项通过、0 失败。
- Node.js `v22.17.1` 下 `npm run ci-test` 退出码 0；Wrangler `4.112.0` 编译成功并解析 7 条重定向，59 项测试通过、0 失败。
- 真实本地 HTTP 流程确认：未认证首页 302、登录页 200、未认证上传 401、正确登录 200、认证后首页 200、缺少本地 Telegram 测试配置时上传 503、退出 200。
- 测试只使用本地开发值和本地 KV，没有调用真实 Telegram、Cloudflare 生产 KV 或生产 Pages 项目。

### 当前状态

DEV-010 已完成但尚未提交、推送或部署。生产环境仍需由项目所有者在 Production 绑定真实 `img_url` KV Namespace，并在重新部署后按部署文档验收。

## 2026-07-20：自动短链与 KV 配额优化

### 目标与约束

- 新上传返回明显更短的公开地址，短码只能由后端自动生成，不提供自定义命名。
- 复用现有 `img_url`，不增加短链专用 KV；`UPLOAD_AUTH_KV` 继续只保存上传认证失败计数。
- 保留旧 `/file/:id`、后台管理、拖拽上传、上传进度和成功响应数组结构。

### 已完成

- 上传成功后使用 Web Crypto 生成 9 字节随机值并编码为 12 位 Base64URL 短码，返回 `/i/{short-code}.{extension}`。
- KV 键改为短码和安全扩展名，同一元数据新增 `telegramFileId`，并继续保存文件名、大小、时间、名单和收藏状态。
- 新增 `/i/:short-code.ext` Pages Function 路由；一次 `getWithMetadata()` 同时解析 Telegram 文件标识和管理元数据，不做额外碰撞查询。
- 取消已有元数据在每次公开访问后的无变化 KV 写回；只在初始化旧记录或内容审核结果变化时写入。
- `/file/:id` 识别带 `telegramFileId` 的短码记录，保持现有后台预览和复制路径可用；旧 Telegram 与 Telegraph 链接继续兼容。
- Telegram 上传成功但 KV 写入失败时返回旧式长 `/file/` 地址，避免短链不可访问和重复上传。
- 同步中英文 README、项目概览、需求、计划、决策、部署说明和变更记录；未增加依赖、环境变量或 Cloudflare 资源。

### 验证

- 修改前基线：工作区 Node.js `v24.14.0` 下 57 项单元测试通过；Wrangler `4.112.0` HTTP 回归 59 项通过。
- 短链相关测试 29 项通过，覆盖短码格式、元数据、单次 KV 读取、零无效写回、缺失映射、KV 不可用、旧 `/file/` 和后台兼容。
- 完整回归：单元测试 61 项通过、0 失败；Wrangler 编译成功并通过 63 项真实 Pages HTTP 回归、0 失败，`/i/*` 已确认进入 Function。
- 未调用真实 Telegram、Cloudflare 生产 KV 或生产 Pages 项目。

### 当前状态

DEV-011 已完成本地实现，尚未提交、推送或部署。当前稳定回退标签仍为 `stable-2026-07-20`（提交 `9c74642`）。

## 2026-07-21：个人博客发布文章

### 已完成

- 新增 `docs/T_IMG_BLOG_ARTICLE.md`，以提交 `dd84d7e` 为内容基线，提供可直接发布的中文 Markdown 长文。
- 文章包含项目背景、能力、Mermaid 架构图、目录结构、后端上传认证、安全 Cookie、强密码策略、上传链路、自动短链、兼容策略、Cloudflare 配置表、部署教程、本地测试、验收清单、错误排查、免费额度、双重回退和已知限制。
- 将原简要部署说明扩展为从零教程：准备独立 GitHub 仓库、创建专用 Telegram Bot 和频道、通过官方 Bot API 获取 Chat ID、创建并绑定唯一必需的 `img_url` KV、配置 Pages 构建参数、逐项选择 Production Text/Secret、生成强密码和会话密钥、启用 Fail closed、触发新部署、核对部署日志及完成首次登录、上传和后台验收。
- 增加生产/预览环境差异、配置变更生效条件、无痕窗口与未登录接口验证、自定义域名 Cookie 行为以及最终配置核对表。
- 将“配置未完成”排错从单行提示扩展为浏览器 Network、响应代码、Production 部署、Functions 日志和静态资源 503 的顺序化诊断流程。
- 使用公开项目地址、官方文档链接和占位配置；未写入生产密码、Telegram Token、Chat ID、Cookie 或 Authorization Header。
- 按协作规则未在博客维护文档中重复建立项目来源仓库关联，来源致谢继续只由中英文 README 维护。

### 验证

- 文章中的路由、变量、KV 绑定、短码长度、测试数量和稳定标签已与当前代码及项目文档核对。
- Pages Git 集成、KV 控制台绑定和 Fail closed 步骤已与 Cloudflare 官方文档核对；BotFather、`getUpdates` 和 Chat ID 形式已与 Telegram 官方文档核对。
- 本任务只新增和同步 Markdown 文档，不修改运行代码、依赖、环境变量或 Cloudflare 资源，因此不重复运行 Functions 测试。

### 当前状态

DEV-012 已完成本地文档整理，尚未提交、推送或部署。

## 2026-07-23：移除上传错误次数记录与认证 KV

### 目标与决策

- 按项目所有者确认，上传认证恢复为最简后端强密码方案：没有正确密码就不能进入上传页或调用上传接口，不保存错误次数，也不需要后台查看失败记录。
- 保留 HMAC-SHA256 签名会话、`__Host-` HttpOnly/Secure/SameSite Cookie、页面和 `POST /upload` 双重校验、同源检查、退出和 Fail closed。
- 唯一必需 KV 继续是 `img_url`；它保存短链、Telegram 文件标识和管理元数据，不能随旧认证 KV 一起删除。

### 已完成

- 从上传认证工具和登录 API 删除 `UPLOAD_AUTH_KV` 检查、匿名化键、失败计数、清理逻辑以及 429/503 限流分支；错误密码统一返回 401 `invalid_credentials`。
- 登录页脚本移除 429 专用提示；原上传、拖拽、进度、结果展示、公开文件和后台管理逻辑未修改。
- 本地 Wrangler 启动命令只绑定 `img_url`，不再创建或读取认证 KV。
- 回归测试改为验证无认证 KV 时正确登录、会话和退出正常，以及连续错误密码始终返回 401 且不设置 Cookie。
- 中英文 README、`.env.example`、部署指南、项目概览、需求、计划、决策、变更记录和博客统一改成“两个 Secret + 一个必需 `img_url` KV”。
- README、部署指南和博客增加 Windows PowerShell 密码学安全随机生成命令：访问密码使用 24 字节随机数据并输出 32 字符 Base64，会话密钥独立使用 48 字节随机数据并输出 64 字符 Base64。生产访问密码建议至少 24 个随机字符。
- 部署迁移顺序明确为：先部署新代码并完成登录与上传验收，再删除 Pages 的 `UPLOAD_AUTH_KV` 绑定；确认无其他项目使用后才删除旧 Namespace，禁止删除 `img_url`。

### 验证

- Node.js `v24.14.0` 直接执行相关认证测试：14 项通过、0 失败。
- 受限沙箱内标准 `npm test` 因 Node 测试运行器无法创建子进程而出现 `spawn EPERM`；在允许子进程的环境中重新执行标准 `npm test`：60 项通过、0 失败；另以 Node.js `v24.14.0` 的无测试隔离模式复核同一完整套件，同样为 60 项通过、0 失败。
- 使用 Wrangler `4.112.0`、Node.js `v24.14.0` 和只绑定 `img_url` 的本地 Pages 环境完成真实 HTTP 回归：62 项通过、0 失败；确认未认证页面跳转、未认证上传 401、正确密码签发会话、认证后页面可访问、缺少本地 Telegram 测试配置时安全返回 503，以及退出后会话失效。
- `git diff --check` 通过；运行代码和测试中已无 `UPLOAD_AUTH_KV`、登录限流函数或 `login_rate_limit` 错误码引用。
- 测试未调用真实 Telegram、Cloudflare 生产 KV 或生产 Pages 项目，未生成或写入真实密码。

### 当前状态

DEV-013 已完成本地实现与文档同步，尚未提交、推送或部署。Cloudflare 生产环境仍由项目所有者按迁移顺序调整。

## 2026-07-23：自定义域名与 WAF 人机验证教程

### 目标与边界

- 在不恢复认证 KV、不修改运行代码的前提下，为公网部署补充 Cloudflare 边缘人机验证和自动化流量防护教程。
- 保持 `/i/*`、`/file/*` 公开访问；WAF 不能替代后端上传密码、签名会话、上传接口二次校验、Fail closed 或后台认证。
- 本任务只修改仓库文档，不创建域名、DNS、WAF、Rate Limiting、Access、Turnstile 或其他 Cloudflare 生产资源。

### 已完成

- 中英文 README 增加自定义域名、已代理 DNS、WAF Managed Challenge、Challenge Passage、`*.pages.dev` 防旁路和可选边缘加固的快速说明。
- 部署指南增加完整七步教程：域名区域激活、Pages Custom domains、Bulk Redirect、窄范围 WAF 表达式、两类 Cookie 分层、可选 Rate Limiting/Managed Rules/Bot Fight Mode、验收与回退。
- 推荐规则只匹配 `/upload-login`、`/upload-login/`、`/upload-login.html` 和 `POST /api/upload-auth/login[/]`；明确不质询 `/i/*`、`/file/*`、静态资源、会话 API 与默认 `POST /upload`，避免 Pages 等价路径绕过以及公开图片和 XHR 上传收到 Challenge Page。
- 博客补充同等可独立阅读的操作步骤、最终配置表、验收清单、故障排查、免费额度和已知限制，并增加 Cloudflare 官方参考链接。
- 明确域名级 WAF 不覆盖 Pages 默认 `*.pages.dev`；生产默认域名必须使用 Bulk Redirect 保留路径和查询参数跳向自定义域名，Preview 需要重定向或 Access 单独收口。
- 区分 Cloudflare `cf_clearance` 与 T-IMG `__Host-t_img_upload_session`；Challenge Passage 建议先保持 30 分钟，上传会话继续默认 7 天。
- 同步项目概览、需求 DEV-014、计划、ADR-015 和变更记录。
- 根据 Cloudflare 2026 年新版安全控制台调整导航说明：新版入口为 `安全性 > 安全规则 > 创建规则 > 自定义规则`，并保留旧版 `Security > WAF > Custom rules` 作为兼容提示；托管规则集入口同步改为新版 `安全性 > 设置`。
- 根据实际规则创建页面补充状态选择：生产规则必须选“活动（Active）”后部署；“已禁用（Disabled）”仅保存配置，不执行托管质询。

### 核对

- 自定义域名添加顺序、Pages 关联要求和默认域名重定向已与 Cloudflare Pages 官方文档核对。
- WAF Custom Rules、Managed Challenge、Free 计划可用性、Challenge Passage、Rate Limiting、Bot Fight Mode 阶段与 Security Events 排错已与 Cloudflare 官方文档核对。
- 教程只使用 `img.example.com`、`<PROJECT>.pages.dev` 等占位主机名，不包含真实域名、密码、Token、Cookie、API Key 或账户标识。
- 本轮不修改 Functions、静态运行页面、测试或依赖，不需要真实 Cloudflare 请求；Node.js `v24.14.0` 无测试隔离模式完整回归 60 项通过、0 失败，`git diff --check` 通过。

### 当前状态

DEV-014 已完成本地文档更新，尚未提交、推送或修改 Cloudflare 生产环境。

## 2026-07-23：修复 GitHub Actions 依赖审计阻断

### 问题与原因

- GitHub Actions `CI` 第 8 次运行在 `Audit dependencies` 步骤退出 1，后续 Pages 和回归测试被跳过；前一提交的同一工作流成功，说明失败来自新发布的 npm 安全公告而非测试回归。
- 官方 npm Registry 审计发现 `concurrently` 10.0.3 间接使用存在高危复杂度拒绝服务问题的 `shell-quote` 1.8.4；Wrangler 4.112.0 的 Miniflare 还固定 Sharp 0.34.5，命中新发布的 libvips 继承漏洞公告。
- `concurrently` 已有兼容修复版本 9.2.4。当前最新版 Wrangler 仍使用 Sharp 0.34.5；npm 建议降到 Wrangler 4.15.2 会回退当前 Runtime，强制覆盖 Sharp 0.35 也不是 Cloudflare 上游验证组合。

### 已完成

- 将 `concurrently` 精确固定到 9.2.4，锁文件同步使用已修复的 `shell-quote` 1.9.0。
- CI 将 `npm audit --omit=dev --audit-level=high` 作为阻断式生产依赖审计。
- 完整开发依赖审计继续运行并展示上游 Wrangler/Sharp 公告，但使用 `continue-on-error`，保证 Pages HTTP 和回归测试仍然执行。
- 记录 ADR-016，并同步开发计划和变更记录；未修改 T-IMG 运行代码、Cloudflare 绑定或生产环境。

### 验证

- 按锁文件重新安装成功；本地工作区仅提供 Node.js `v24.14.0`，因此出现项目要求 Node 22 的预期引擎警告，GitHub Actions 仍使用正式 Node.js 22 基线。
- 阻断式 `npm audit --omit=dev --audit-level=high`：0 项漏洞、退出 0。
- 完整开发依赖审计：`concurrently`/`shell-quote` 告警已消失；剩余 3 个高危条目全部属于 Wrangler → Miniflare → Sharp 同一上游链路，按 ADR-016 保持可见。
- 标准 `npm test`：60 项通过、0 失败。
- `npm run ci-test`：Wrangler 4.112.0 编译成功，62 项 Pages HTTP 与回归测试通过、0 失败；`concurrently` 9.2.4 能在测试成功后终止本地服务。
- `git diff --check` 和新一轮 GitHub Actions 待提交前及推送后确认。

### 当前状态

DEV-015 本地实现与主要验证完成，尚未提交或推送。
