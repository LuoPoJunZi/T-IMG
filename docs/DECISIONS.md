# 技术决策记录

## ADR-001：先建立标准化基线，再实施正式业务需求

- 日期：2026-07-18
- 状态：已接受
- 决策：先完成仓库检查、协作规则、文档、测试、忽略规则和 CI 基线；总任务说明中的示例功能不自动进入开发范围。
- 原因：避免把示例误当正式需求，并保证后续变更可追踪、可测试、可回滚。
- 相关需求：DEV-001

## ADR-002：JavaScript 统一使用 ES Modules

- 日期：2026-07-18
- 状态：已接受
- 决策：在 `package.json` 声明 `"type": "module"`，Functions 和测试统一使用 ESM。
- 原因：Cloudflare Pages Functions 原生使用 `import`/`export`，统一模块系统可消除本地与运行时解析差异。
- 相关需求：DEV-001

## ADR-003：T-IMG 不配置外部代码同步

- 日期：2026-07-18
- 状态：已接受
- 决策：T-IMG 作为独立公开仓库维护，不建立 GitHub fork、额外代码远程或自动同步工作流；发布时只配置个人仓库为 `origin`。
- 原因：防止外部代码未经审查进入 `main`，也避免远程配置造成误推。
- 影响：任何功能或依赖变化都通过 T-IMG 自身的 Issue、Pull Request、审计和测试流程维护。
- 相关需求：DEV-001

## ADR-004：依赖目录不进入版本控制

- 日期：2026-07-18
- 状态：已接受
- 决策：Git 不跟踪 `node_modules/`，依赖以 `package-lock.json` 和 `npm ci` 为准。
- 原因：减少仓库体积和跨平台噪音，并确保安装来源可追踪。
- 相关需求：DEV-003

## ADR-005：项目品牌与公开仓库名称统一为 T-IMG

- 日期：2026-07-18
- 状态：已接受
- 决策：页面、README、包信息和维护文档统一使用 `T-IMG`；npm 和 Cloudflare 合法标识使用 `t-img`。
- 原因：建立一致、独立的项目身份。
- 影响：来源致谢和许可证入口只在中英文 README 中维护。
- 相关需求：DEV-002

## ADR-006：默认不发送第三方遥测

- 日期：2026-07-18
- 状态：已接受
- 决策：移除固定 Sentry 客户端、Functions 遥测依赖和百度页面追踪，只保留不泄露堆栈及请求数据的本地错误处理。
- 原因：安全默认值是不把请求、凭据或运行环境发送到项目所有者不控制的账户。
- 相关需求：DEV-006

## ADR-007：上传上限以文件可取回为准

- 日期：2026-07-18
- 状态：已接受
- 决策：默认及最高上传限制为 20 MiB，允许通过 `MAX_UPLOAD_SIZE_BYTES` 向下调整。
- 原因：现有公开 Telegram Bot API 文件取回链路限制为 20 MiB；只允许上传而无法代理取回会产生不可用记录。
- 相关需求：DEV-004

## ADR-008：兼容日期只固定在本地命令

- 日期：2026-07-18
- 状态：已接受
- 决策：在 `npm start` 的 Wrangler 命令中固定兼容日期，不提交未知生产绑定的 Wrangler 配置文件。
- 原因：消除本地日期漂移，同时避免仓库配置意外接管 Cloudflare Pages 控制台中的生产绑定。
- 相关需求：DEV-003

## ADR-009：规范名称作为主入口并保留旧路径兼容

- 日期：2026-07-18
- 状态：已接受
- 决策：页面、普通源码和资源使用语义化 kebab-case，区域化 README 使用 `README.zh-CN.md`，资源集中到 `assets/`；旧静态 URL 由 `_redirects` 永久重定向，旧驼峰 API 使用轻量转发文件兼容。
- 原因：统一长期命名规则，同时避免已部署链接和客户端立即失效。
- 相关需求：DEV-007

## ADR-010：公开发布使用 Node.js 22 和 GitHub Actions

- 日期：2026-07-18
- 状态：已接受
- 决策：运行基线升级到 Node.js 22 和 Wrangler 4；测试迁移到 Node 内置测试运行器；CI 在 `main` 推送、Pull Request 和手动触发时运行，并将 GitHub 官方 Action 固定到完整提交 SHA。
- 原因：旧运行基线和测试依赖已过时；内置测试运行器减少依赖面，升级后 npm 官方安全审计为 0 漏洞。
- 相关需求：DEV-008

## ADR-011：上传访问使用独立密码和签名 Cookie 会话

- 日期：2026-07-19
- 状态：已接受
- 修订：2026-07-23 起，登录限流部分由 ADR-014 取代；密码校验、签名 Cookie、上传接口二次校验和失败关闭继续有效。
- 决策：上传页面由根级 Pages Functions 中间件保护；密码只在后端校验，成功后签发 HMAC-SHA256 签名的 `__Host-`、`HttpOnly`、`Secure`、`SameSite=Strict` Cookie；`POST /upload` 再次验证会话并拒绝浏览器跨站请求。登录失败使用独立 `UPLOAD_AUTH_KV` 做匿名化基础限流，缺少关键配置时失败关闭。
- 原因：前端隐藏或 localStorage 标记可被绕过；无状态签名会话适合 Pages Functions，不需要新增运行依赖；独立限流 KV 不污染 `img_url` 图片索引。
- 兼容：`/file/:id` 保持公开，后台管理认证不变；有效后台 Basic Auth 仍可调用 `/upload`，以保持画廊批量上传。`_routes.json` 同时包含 `.html` 与 Pages Clean URLs 等价路径，生产配额行为必须设置为 Fail closed。
- 限制：Cloudflare KV 计数最终一致，只提供基础暴力破解防护；高风险部署应叠加边缘 WAF/Rate Limiting 或 Access。
- 相关需求：DEV-009

## ADR-012：`img_url` 是上传必需绑定并在外部写入前校验

- 日期：2026-07-19
- 状态：已接受
- 背景：二次开发后的代码、测试和文档把 `img_url` 当成可选项，导致缺少绑定或误设为文本时仍可能向 Telegram 上传并返回无法进入索引和后台管理的文件；现有单元测试未通过 Pages HTTP 路由验证该配置链路。
- 决策：`POST /upload` 在联系 Telegram 前验证非空 Telegram 字符串配置和具有 `put()` 的 `img_url` KV 绑定；缺失或类型错误返回不泄密的 503，并仅在服务端日志列出配置名称。Telegram 已接受文件后的瞬时 KV 写入失败继续返回成功，避免重试产生重复文件。已有 `/file/:id` 在 KV 绑定异常时保持公开访问。CI 增加本地 Wrangler HTTP 登录、Cookie、退出与上传路由冒烟测试。
- 原因：区分部署配置缺失和外部写入后的瞬时故障，既保证新上传具有索引前提，也保护既有公开链接和避免重复上传。
- 备选方案：继续把 KV 视为可选会产生不受后台管理的记录；Telegram 成功后因 KV 瞬时失败返回错误会诱导重复上传；把具体配置值返回前端会增加泄密风险。
- 影响：生产环境必须把 `img_url` 配置为大小写完全一致的 KV Namespace 绑定并重新部署；前端只显示安全分类提示，具体缺失名称从 Functions 日志查看。
- 相关需求：DEV-004、DEV-010

## ADR-013：短码复用 `img_url` 并由后端自动生成

- 日期：2026-07-20
- 状态：已接受
- 背景：完整 Telegram `file_id` 直接出现在公开 `/file/` 地址中，链接过长；新增独立别名 KV 或每次上传先查询碰撞会增加免费额度消耗和部署配置。
- 决策：新上传使用 Web Crypto 生成 9 字节随机值并编码为 12 位 Base64URL 短码，公开路径为 `/i/{short-code}.{extension}`。现有 `img_url` 的 KV 键保存短码和扩展名，同一条元数据保存完整 `telegramFileId` 与管理字段；不提供自定义命名，不新增 KV 绑定，不执行碰撞查询。
- 配额：普通短链请求只调用一次 `getWithMetadata()`，以同一记录同时取得 Telegram 标识和管理状态；已有元数据未变化时不执行 `put()`。72 位随机空间使碰撞概率足够低，且 KV 最终一致性也不适合依赖“先读后写”实现严格唯一性。
- 兼容：旧 `/file/:id` 链接继续公开；文件代理识别带 `telegramFileId` 的短码记录，使后台现有 `/file/短码` 预览仍可使用。Telegram 已成功但短码 KV 写入失败时返回旧式长链接，避免产生不可访问结果。
- 故障语义：无短码记录返回 404；短链依赖的 `img_url` 不可用时返回 503；错误和日志不包含完整 Telegram 标识或密钥。
- 相关需求：DEV-011

## ADR-014：上传认证不保存错误次数

- 日期：2026-07-23
- 状态：已接受
- 背景：T-IMG 面向个人部署，项目所有者决定采用最简认证模型：没有正确密码就拒绝访问和上传，不保存错误次数，也不为登录限流维护额外 KV。
- 决策：移除 `UPLOAD_AUTH_KV` 绑定、登录失败计数和 429 分支。每次错误密码均由后端安全比较后返回统一 401，不创建会话、不记录密码，也不读写 KV；正确密码仍签发安全会话 Cookie，上传页面和 `POST /upload` 的后端校验、跨站防护及 Fail closed 保持不变。
- 安全边界：生产访问密码应使用密码学安全随机源生成至少 24 个随机字符，会话密钥独立生成并至少 32 字符；二者都保存为 Cloudflare Secret。错误请求仍会消耗 Pages Functions 请求，不应把“无 KV 操作”理解为完全无资源消耗。
- 取舍：减少一个 KV Namespace、运行时读写和部署配置，但不再提供应用内暴力破解限流。公开范围扩大或出现异常流量时，应优先在自定义域名的 Cloudflare 边缘叠加 WAF/Rate Limiting、Turnstile 或 Access。
- 迁移：先部署新代码并验证登录与上传，再移除 Pages 的 `UPLOAD_AUTH_KV` 绑定；确认无其他项目使用后可删除旧 Namespace。`img_url` 是图片数据必需绑定，不能删除。
- 相关需求：DEV-013；取代 ADR-011 中的登录限流部分

## ADR-015：自定义域名的 WAF 只质询上传登录入口

- 日期：2026-07-23
- 状态：已接受
- 背景：应用内不记录失败次数后，需要提供不消耗认证 KV 的可选边缘防护；同时公开 `/i/*`、`/file/*` 必须继续适合博客引用和匿名访问。
- 决策：生产环境建议绑定由 Cloudflare 区域代理的自定义域名，并以 WAF Custom Rule 的 Managed Challenge 只匹配上传登录页面、Pages 尾斜杠等价路径和 `POST /api/upload-auth/login[/]`。不对全站、公开文件、静态资源、会话 API 或 `POST /upload` 做默认质询；T-IMG 后端密码、签名会话和 Fail closed 继续作为必需防护。
- 防旁路：域名级 WAF 不覆盖 Pages 自动生成的 `*.pages.dev` 主机名；生产默认域名必须通过 Bulk Redirect 保留路径和查询参数跳往自定义域名，Preview 则使用重定向或 Access 明确收口。
- 认证分层：Cloudflare `cf_clearance` 证明浏览器通过人机验证，T-IMG `__Host-t_img_upload_session` 证明用户输入正确访问密码。Challenge Passage 建议先保持 30 分钟，不与默认 7 天上传会话强行对齐。
- 取舍：窄范围规则减少自动化登录流量且不修改项目代码；全站 Managed Challenge、Bot Fight Mode 和过严 Rate Limiting 可能误伤公开图片、共享出口和非浏览器客户端，启用后必须根据 Security Events 调整。
- 相关需求：DEV-014

## ADR-016：生产依赖审计阻断，开发工具公告保持可见

- 日期：2026-07-23
- 状态：已接受
- 背景：新的 npm 高危公告同时命中 `concurrently` 的 `shell-quote` 和 Wrangler/Miniflare 固定的 Sharp。前者已有兼容安全版本；后者在当前最新版 Wrangler 中仍未由上游升级，npm 建议的 Wrangler 4.15.2 会大幅回退本地 Workers Runtime，强制覆盖 Sharp 也不属于上游支持组合。
- 决策：将 `concurrently` 固定到使用 `shell-quote` 1.9.0 的 9.2.4。CI 对生产依赖执行 `npm audit --omit=dev --audit-level=high` 并保持阻断；完整开发依赖审计继续运行并显示公告，但使用 `continue-on-error`，不得阻止真实 Pages HTTP 和回归测试。
- 安全边界：T-IMG 没有随生产 Pages 站点发布的 npm 运行依赖；Wrangler、Miniflare 和 Sharp 只用于本地/CI Pages 模拟。非阻断不等于忽略，需持续观察上游版本并在其提供兼容安全组合后正常升级。
- 取舍：不为了让审计报告归零而使用失真的旧 Runtime 或未验证的传递依赖覆盖；同时避免一个无法由本项目修复的开发工具公告跳过全部功能测试。
- 相关需求：DEV-015；修订 ADR-010 中“npm 官方安全审计为 0 漏洞”的时点描述
