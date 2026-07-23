# T-IMG 项目概览

## 项目定位与来源

T-IMG 是一个静态前端与 Cloudflare Pages Functions 组合的文件托管项目。当前版本通过 Telegram Bot API 上传和存储文件，并为新上传自动生成同域短链；上传页面和上传接口由独立密码会话保护；唯一必需的 `img_url` KV 保存短码映射、图片索引和元数据，并支持后台管理、黑白名单和内容审核。

T-IMG 作为独立公开仓库长期维护，不配置 fork、外部代码远程或自动同步关系。项目来源致谢与许可证入口仅在 README 中维护。

## 技术栈与目录

- 前端：静态 HTML、CSS、浏览器 JavaScript；首页包含既有 Nuxt 静态资源，管理页使用页面内脚本和现有 CDN 资源。
- 后端：Cloudflare Pages Functions，使用 ES Modules 与 Web Platform API。
- 存储：Telegram 负责文件内容；Cloudflare KV 绑定 `img_url` 负责短码、完整 Telegram 文件标识、索引和元数据。上传认证不保存错误次数，也不需要额外 KV。
- 异常处理：本地通用错误中间件；T-IMG 不加载或发送第三方固定 Sentry 遥测。
- 工具：Wrangler 4、Node.js 22 内置测试运行器、Node.js 22。

主要路径：

| 路径 | 作用 |
|---|---|
| `index.html`、`markdown-upload.html` | 两个受后端会话保护的上传入口 |
| `upload-login.html` | 上传访问密码验证入口 |
| `admin.html` | 基础管理页面 |
| `admin-gallery.html` | 画廊管理页面，含上传、列表和批量操作 |
| `admin-waterfall.html` | 瀑布流查看页面 |
| `assets/` | 按 `images`、`icons`、`styles`、`scripts` 分类的静态资源 |
| `functions/_middleware.js` | 拦截上传页及 Pages Clean URLs 等价路径，验证签名会话 |
| `functions/upload.js` | 上传入口 |
| `functions/file/[id].js` | 文件访问、KV 元数据和审核入口 |
| `functions/i/[id].js` | 自动短链入口，复用文件代理逻辑 |
| `functions/api/upload-auth/` | 上传访问登录、会话状态和退出接口 |
| `functions/api/manage/` | 管理认证及列表、删除、黑白名单等接口 |
| `functions/utils/middleware.js` | 不泄露堆栈的通用错误中间件 |
| `functions/utils/upload.js`、`upload-auth.js`、`file.js`、`auth.js`、`manage.js` | 上传、上传会话、文件代理、认证和管理公共逻辑 |
| `test/*.test.js` | 上传、文件代理、认证、管理与 KV 分页回归测试 |

## Functions 路由

| 方法/路径 | 代码 | 当前行为 |
|---|---|---|
| `GET /`、上传页别名 | `functions/_middleware.js` | 验证上传会话；未验证时跳转 `/upload-login` |
| `POST /upload` | `functions/upload.js` | 先验证上传会话、Telegram 配置及 `img_url` KV，再上传 Telegram、写入元数据并返回文件路径数组 |
| `POST /api/upload-auth/login` | 对应文件 | 在后端校验密码，成功时签发安全会话 Cookie |
| `GET /api/upload-auth/session` | 对应文件 | 返回当前上传会话是否有效 |
| `POST /api/upload-auth/logout` | 对应文件 | 清除上传会话 Cookie |
| `GET|HEAD /i/:short-code.ext` | `functions/i/[id].js` | 从 `img_url` 一次读取短码映射和管理元数据，再代理 Telegram 文件 |
| `* /file/:id` | `functions/file/[id].js` | 代理 Telegraph/Telegram 文件，执行 KV 黑白名单与可选内容审核 |
| `GET /api/bing/wallpaper` | `functions/api/bing/wallpaper/index.js` | 代理 Bing 壁纸数据 |
| `GET /api/manage/list` | `functions/api/manage/list.js` | 按 `limit`、`cursor`、`prefix` 列出 KV 记录 |
| `/api/manage/check` | `functions/api/manage/check.js` | 返回是否启用 Basic Auth |
| `/api/manage/login`、`logout` | 对应文件 | 跳转后台或触发浏览器重新认证 |
| `/api/manage/block/:id`、`white/:id` | 对应文件 | 修改 KV 元数据中的名单状态 |
| `/api/manage/delete/:id` | 对应文件 | 删除 KV 记录，不删除 Telegram 文件 |
| `/api/manage/toggle-like/:id` | 对应文件 | 切换 KV 元数据的收藏状态；保留旧 `toggleLike` 兼容入口 |
| `/api/manage/edit-name/:id` | 对应文件 | 修改显示文件名；保留旧 `editName` 兼容入口 |

## 上传请求流程

1. 根级中间件先验证上传页面的签名会话；`POST /upload` 再次验证同一会话或有效的后台 Basic Auth，并拒绝浏览器跨站请求。
2. 前端向 `POST /upload` 提交带 `file` 的 `FormData`；通过认证后，后端确认 Telegram 配置、必需的 `img_url.put()` KV 绑定、非空文件和大小限制。
3. 默认限制为 20 MiB，以匹配公共 Bot API `getFile` 下载能力；可用 `MAX_UPLOAD_SIZE_BYTES` 向下调整。
4. Function 根据 MIME 前缀选择 Telegram 的 `sendPhoto`、`sendAudio`、`sendVideo` 或 `sendDocument`，并清理文件名和扩展名。
5. 图片方式失败时改用文档方式；网络异常最多重试两次。Telegram 内部描述不会直接返回客户端。
6. 从 Telegram 响应提取并验证 `file_id`，通过 Web Crypto 生成 12 位、72 位随机性的 URL 安全短码；不接受用户自定义短码。
7. 以 `{short-code}.{extension}` 为 `img_url` 键，在同一条元数据中保存完整 `telegramFileId`、文件名、大小和管理状态，不新增 KV 命名空间，也不为碰撞检查增加 KV 读取。
8. KV 写入成功时保持原有响应数组和 `src` 字段结构，返回 `[{"src":"/i/..."}]`。若 Telegram 已成功但 KV 写入瞬时失败，则返回仍可直接解析的旧式 `/file/{file_id}.{extension}` 长地址，避免无效短链和重复上传。

## 文件访问流程

`functions/i/[id].js` 与 `functions/file/[id].js` 复用同一代理逻辑。短链必须从 `img_url` 读取一条记录，由其中的 `telegramFileId` 定位 Telegram 文件并同时取得管理元数据；正常访问不再重复写回未变化的元数据。`/file/:id` 继续兼容存量规则：具有显式 `telegramFileId` 的短码记录按 Telegram 处理，其他较短标识代理 `https://telegra.ph`，较长标识按旧 Telegram 规则处理。代理只转发 `Accept`、`Range` 和条件请求头，不会把 Cookie 或 Authorization 发往外部。管理页预览在配置 Basic Auth 时必须携带有效凭据。若 KV 临时不可用，已有可直接解析的 `/file/:id` 继续提供服务；`/i/:short-code.ext` 因无法解析映射而安全返回 503。

ModerateContent 仅对旧 Telegraph 文件使用。T-IMG 不把包含 Bot Token 的 Telegram 下载地址发送给审核服务，因此 Telegram 文件的自动审核待未来采用不泄露凭据的方案。

KV 保存的是索引与元数据，不保存文件二进制。删除管理记录不会从 Telegram 服务器删除原文件。

## 后台与认证

上传访问认证与后台认证相互独立。`UPLOAD_ACCESS_PASSWORD` 只在后端校验；成功后使用 `UPLOAD_SESSION_SECRET` 对包含签发时间、过期时间和随机数的会话令牌做 HMAC-SHA256 签名，并写入 `HttpOnly; Secure; SameSite=Strict; Path=/` 的 `__Host-` Cookie。错误密码统一返回 401，不创建会话、不记录密码或失败次数，也不读写认证 KV。缺少密码或签名密钥时认证失败关闭。`_routes.json` 同时覆盖 `.html` 和 Pages Clean URLs 无扩展名路径，防止静态页面绕过中间件。

后台 API 由 `functions/api/manage/_middleware.js` 统一处理：未绑定 `img_url` 时提示后台不可用；设置 `BASIC_USER` 后使用 HTTP Basic Auth 校验 `BASIC_USER` 和 `BASIC_PASS`；未设置用户名时接口不进行 Basic Auth。生产环境应同时配置强用户名和密码，或使用 Cloudflare Access 完整保护 `/admin*` 与 `/api/manage/*`。

## 环境变量与绑定

| 名称 | 必需性 | 用途 |
|---|---|---|
| `TG_Bot_Token` | 上传及 Telegram 文件访问必需 | Telegram Bot Token |
| `TG_Chat_ID` | 上传必需 | Telegram 频道或群组 ID |
| `UPLOAD_ACCESS_PASSWORD` | 上传页面和接口必需 | 代码最低 12 字符；生产建议至少 24 个随机字符并保存为 Secret |
| `UPLOAD_SESSION_SECRET` | 上传页面和接口必需 | 至少 32 字符的随机会话签名密钥，生产中保存为 Secret |
| `UPLOAD_SESSION_MAX_AGE` | 可选 | 会话秒数，默认 604800，允许 300 至 2592000 |
| `img_url` | 上传、短链和后台必需 | Cloudflare KV Namespace 绑定，保存短码映射与管理元数据，不是普通字符串变量或 Secret |
| `BASIC_USER`、`BASIC_PASS` | 后台生产环境强烈建议 | 管理 API Basic Auth 凭据 |
| `ModerateContentApiKey` | 可选 | ModerateContent 图片审核 |
| `WhiteList_Mode` | 可选 | 字符串严格等于 `true` 时开启白名单模式 |
| `MAX_UPLOAD_SIZE_BYTES` | 可选 | 单文件字节上限，默认且最高为 20 MiB |

`.env.example` 仅作变量清单；当前 `npm start` 不会自动读取该文件，实际值通过 Wrangler 参数或 Cloudflare Pages 设置注入。

## 本地开发、测试与部署

使用 Node.js 22 和锁文件执行 `npm ci`，以 `npm start` 启动本地 Pages 环境。`npm test` 执行 Node 内置测试，`npm run ci-test` 同时启动 Wrangler，并通过真实 HTTP 请求回归登录 Cookie、受保护页面、退出和 `/upload` 路由。本地命令自带测试用后台与上传认证绑定，不得用于生产。

Cloudflare Pages 部署无需前端构建命令，仓库根目录作为静态资源目录，`functions/` 由 Pages 自动识别。生产上传前必须配置 Telegram 两项变量、上传密码和会话密钥，并绑定唯一必需的 `img_url` KV。公网部署建议再绑定由 Cloudflare 区域代理的自定义域名，用窄范围 WAF Managed Challenge 保护上传登录，并把生产 `*.pages.dev` 重定向到自定义域名以避免旁路。详细步骤见 `docs/DEPLOYMENT.md`。

## 当前已知限制与风险

- 本地启动命令固定兼容日期，但生产 Pages 项目的实际兼容日期仍需在 Cloudflare 控制台核对；没有真实项目配置时不创建可能接管生产绑定的 Wrangler 配置文件。
- 新短链通过元数据中的 `telegramFileId` 显式记录来源；只有没有新元数据的旧 `/file/:id` 继续使用标识长度启发式判断。
- Telegram 文件不会把带 Token 的下载 URL 交给 ModerateContent，因而当前不执行自动内容审核。
- 自动化测试使用 Mock 覆盖核心失败路径，但真实 Telegram 权限、Cloudflare KV 配额、Pages 控制台设置和外部审核服务仍需在隔离环境验证。
- 应用内不保存登录失败次数，也不提供请求限流；错误尝试仍消耗 Pages Functions 请求。生产必须使用高熵随机访问密码并设置 Fail closed，高风险公开部署还应在自定义域名叠加 Cloudflare WAF/Rate Limiting、Turnstile 或 Access。
- WAF Managed Challenge 默认只适合登录入口；全站质询、Bot Fight Mode 或管理 API 质询可能影响公开图片、非浏览器客户端和上传 XHR。生产应结合 Security Events 收窄规则，并确认 `*.pages.dev` 不再绕过区域 WAF。
- 项目仍依赖 Telegram、Telegraph、Bing 和可选 ModerateContent 等外部服务，其可用性和限制不由 T-IMG 控制。
