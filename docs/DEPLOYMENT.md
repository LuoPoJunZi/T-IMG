# 部署与配置

## 本地开发要求

- Git
- Node.js 22（仓库 CI 使用 Node 22，本次验证为 `v22.23.1`）
- npm 10 或与锁文件兼容的 npm
- 可访问 npm registry；真实上传验证还需可访问 Telegram API

安装依赖：

```bash
npm ci
```

T-IMG 不跟踪 `node_modules/`，依赖版本以 `package-lock.json` 为准。不要提交本地依赖目录。

启动本地 Pages 环境：

```bash
npm start
```

当前脚本在 `http://localhost:8080` 启动 Wrangler，固定本地兼容日期，绑定本地持久化 KV `img_url`，并注入仅用于本地测试的后台与上传认证值。不得把脚本中的测试凭据复用于生产。Wrangler 会将本地状态写入已忽略的 `data/`。

测试命令：

```bash
npm test
npm run ci-test
```

`npm test` 使用 Node.js 内置测试运行器；`npm run ci-test` 同时启动本地 Pages 服务，并通过真实 HTTP 请求验证页面重定向、登录 Cookie、退出和 `/upload` 路由。当前自动化测试使用 Mock 或缺失 Telegram 配置的受控分支，不调用真实 Telegram。

## `.env.example` 的作用

`.env.example` 是安全的变量清单，不包含真实值。当前 `npm start` 通过命令行 `--binding` 注入本地变量，不会自动加载 `.env.example` 或 `.env`。生产变量应在 Cloudflare Pages 控制台设置；如果未来采用 Wrangler 的变量文件功能，应先确认文件已被 `.gitignore` 排除。

## Cloudflare Pages 部署

1. 在自己的 GitHub/GitLab 仓库保留完整项目和 `functions/` 目录。
2. 在 Cloudflare Dashboard 创建 Pages 项目并连接仓库。
3. 本项目静态文件已位于根目录，不需要前端构建命令。构建输出目录使用仓库根目录；具体控制台对“无构建”项目的填写方式以账户界面为准。
4. Pages 自动识别 `functions/` 并部署 Functions 路由。
5. Pages 读取根目录 `_redirects` 和 `_routes.json`；不得删除上传页面、登录页面、Clean URLs 或 `/i/*` 的 Functions 路由规则。登录页安全响应头由根级 Function 设置。
6. 配置下列生产 Secret、变量和 KV 绑定。
7. 在 Pages 项目 Settings > Runtime 将 Functions 配额耗尽行为设置为 **Fail closed**，避免认证 Function 不可用时退回静态上传页面。
8. 变量或绑定变化后重新部署，使 Functions 获得新配置。

仓库没有生产 `wrangler.toml`，避免在未知控制台配置时让仓库文件接管生产绑定。本地 `npm start` 已显式固定兼容日期；生产项目兼容日期必须在 Cloudflare 控制台确认并单独回归测试。

## 上传访问认证（必需）

在 Cloudflare Pages 的 Settings > Variables and Secrets 中配置：

```env
UPLOAD_ACCESS_PASSWORD=replace_with_a_strong_upload_password
UPLOAD_SESSION_SECRET=replace_with_a_long_random_session_secret
UPLOAD_SESSION_MAX_AGE=604800
```

- `UPLOAD_ACCESS_PASSWORD` 代码最低要求 12 字符；生产环境应使用至少 24 个随机字符，并保存为加密 Secret。
- `UPLOAD_SESSION_SECRET` 至少 32 字符，建议使用密码管理器或系统安全随机源生成，必须与访问密码不同并保存为 Secret。
- `UPLOAD_SESSION_MAX_AGE` 可作为普通变量，默认 604800 秒（7 天），允许范围 300 至 2592000 秒（30 天）。修改签名密钥会立即使已有会话失效。

上传认证不记录错误次数，也不需要 `UPLOAD_AUTH_KV`。每次错误密码都由后端校验后返回 401，不会创建会话或写入 KV。错误请求仍会占用一次 Pages Functions 请求，因此强随机密码是这套简化方案的关键；若公开站点出现明显攻击流量，可在自定义域名上另行配置 Cloudflare WAF、Rate Limiting、Turnstile 或 Access。缺少密码或会话密钥时，上传页面和接口会失败关闭并返回 503。

### 上传访问密码配置教程

这里真正提供给访问者输入的密码只有一个：`UPLOAD_ACCESS_PASSWORD`。站点所有者先在 Cloudflare 设置这个密码，访问者打开上传页面时会先进入 `/upload-login`，输入相同密码并经后端校验成功后才能看到和使用上传界面。

`UPLOAD_SESSION_SECRET` 不是第二个登录密码，而是系统内部用于签名安全 Cookie 的随机密钥。访问者不需要知道或输入它。两个值必须不同，也不能使用仓库中的占位值或本地测试值。

#### 第一步：设置用户需要输入的访问密码

进入 Cloudflare Dashboard：

```text
Workers & Pages > T-IMG > Settings > Variables and Secrets > Add
```

新增以下项目，并选择 **Encrypt** 后保存为 Secret：

```text
名称：UPLOAD_ACCESS_PASSWORD
值：站点所有者自行设置的强密码
类型：Secret
```

该值就是访问者在 `/upload-login` 页面需要输入的密码。代码要求至少 12 字符；生产环境建议使用密码管理器生成并保存至少 24 个随机字符，不要使用姓名、生日、手机号、常见短语或其他网站已使用的密码。

也可以在 Windows PowerShell 中运行：

```powershell
$uploadPasswordBytes = New-Object byte[] 24
$uploadPasswordGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$uploadPasswordGenerator.GetBytes($uploadPasswordBytes)
[Convert]::ToBase64String($uploadPasswordBytes)
$uploadPasswordGenerator.Dispose()
```

该命令使用系统密码学安全随机源，输出 32 字符的 Base64 字符串，包含 192 位随机数据。复制输出并保存到 Cloudflare Secret 和密码管理器后，不要继续在终端截图、聊天或文档中传播该值。

#### 第二步：生成并设置系统内部会话密钥

可使用密码管理器生成至少 32 字符的随机值，也可在 Windows PowerShell 中运行：

```powershell
$sessionSecretBytes = New-Object byte[] 48
$sessionSecretGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$sessionSecretGenerator.GetBytes($sessionSecretBytes)
[Convert]::ToBase64String($sessionSecretBytes)
$sessionSecretGenerator.Dispose()
```

复制命令输出，在同一 Cloudflare 页面新增：

```text
名称：UPLOAD_SESSION_SECRET
值：刚生成的随机字符串
类型：Secret（选择 Encrypt）
```

不要把输出提交到 Git、写入 README、发送到聊天或复用为 `UPLOAD_ACCESS_PASSWORD`。修改该密钥会立即让已有登录会话失效。

#### 第三步：设置登录保持时间

新增普通变量：

```text
名称：UPLOAD_SESSION_MAX_AGE
值：604800
类型：普通变量
```

`604800` 表示 7 天。也可使用 `86400`（1 天）；代码允许的范围为 300 秒至 2592000 秒（30 天）。

#### 第四步：创建并绑定图片元数据 KV

1. 在 Cloudflare Dashboard 的 Workers KV 页面选择 **Create instance**。
2. Namespace 名称可填写 `t-img-images`；资源名称可以自定义。
3. 回到 `Workers & Pages > T-IMG > Settings > Bindings`。
4. 选择 **Add > KV Namespace**。
5. Variable name 必须严格填写 `img_url`，大小写不能改变。
6. 选择刚创建的图片元数据 Namespace 并保存。

`img_url` 是完整上传和后台管理必需的 KV 绑定，不能在 Variables and Secrets 中添加为普通文本或 Secret。代码会在联系 Telegram 前验证该绑定，缺失或类型错误时返回 503，避免产生没有索引记录的新文件。

#### 第五步：设置失败关闭并重新部署

进入：

```text
Workers & Pages > T-IMG > Settings > Runtime > Fail open / closed
```

选择 **Fail closed**。认证 Function 无法执行或免费配额耗尽时，Cloudflare 将返回错误页面，而不是绕过认证继续提供静态上传页面。完成 Secret、变量和 `img_url` KV 绑定后重新部署最新 `main`；生产环境至少需要配置 Production，使用 Preview 时还需单独检查 Preview 配置。

Cloudflare 官方参考：[Pages Functions 变量与 Secret](https://developers.cloudflare.com/pages/functions/bindings/)、[Workers KV 创建与绑定](https://developers.cloudflare.com/kv/get-started/)、[Pages Functions Fail closed](https://developers.cloudflare.com/pages/functions/routing/)。

#### 第六步：部署后验收

1. 使用无痕窗口打开 `/` 或 `/markdown-upload.html`，应先跳转到 `/upload-login`。
2. 输入与 `UPLOAD_ACCESS_PASSWORD` 不同的密码，应拒绝进入。
3. 输入完全相同的密码，应进入原上传界面并可正常上传。
4. 刷新页面，在 `UPLOAD_SESSION_MAX_AGE` 有效期内应保持登录。
5. 上传页不显示退出按钮；如需验证退出接口，可从已登录的同源页面向 `/api/upload-auth/logout` 提交 `POST`，或清除该站点 Cookie，随后再次访问上传页应重新要求输入密码。
6. 未登录直接请求 `POST /upload` 应返回 401；已有 `/file/:id` 仍应公开访问，后台管理不应被重定向到上传登录页。

## Telegram 必需变量

```env
TG_Bot_Token=your_telegram_bot_token
TG_Chat_ID=your_telegram_chat_id
MAX_UPLOAD_SIZE_BYTES=20971520
```

Bot 必须有向目标频道或群组发送文件的权限。缺少任一必需变量时上传接口返回 503。`MAX_UPLOAD_SIZE_BYTES` 可选，只能降低默认 20 MiB 上限；该上限用于保证文件可由公共 Bot API `getFile` 路径取回。

## 图片元数据 KV 命名空间绑定

上传索引、后台管理、元数据、黑白名单和审核记录依赖 KV。先创建 KV 命名空间，再在 Pages 项目的 Functions 设置中添加绑定：

```text
变量名称：img_url
绑定类型：KV Namespace
目标：选择专用于本项目的命名空间
```

`img_url` 不是普通环境变量，而是生产上传必需的 KV Namespace 绑定。代码在向 Telegram 发送文件前检查它是否提供 KV `put()` 方法；未绑定、名称错误或误设为文本时，`POST /upload` 返回 503 且不会联系 Telegram。新上传使用自动生成的 12 位随机短码作为 KV 键的一部分，同一条元数据保存完整 Telegram 文件标识和管理字段；不需要新增短链 KV，也不提供自定义短码。普通 `/i/:short-code.ext` 访问只读取一次 `img_url` 记录，不写回未变化的元数据。

已存在的 `/file/:id` 仍保持公开访问，管理 API 和既有后台预览方式保持兼容。Telegram 已接受文件后若发生瞬时 KV 写入失败，接口会返回可直接访问的旧式 `/file/{file_id}.{extension}` 长地址，并记录不含敏感值的警告，避免返回无效短链或诱导用户重复上传。

## 自定义域名与 Cloudflare WAF 加固（建议）

T-IMG 的后端强密码是第一道认证；Cloudflare WAF Managed Challenge 可以在请求到达 Pages Functions 前增加人机验证，降低自动化密码尝试和无效 Functions 请求。两层防护相互独立，WAF 不能替代 `UPLOAD_ACCESS_PASSWORD`，后端认证也不能替代边缘流量防护。

### 第一步：把域名交由 Cloudflare 托管

建议使用独立子域名，例如 `img.example.com`。若域名尚未加入 Cloudflare：

1. 在 Cloudflare 添加根域名 `example.com`。
2. 按控制台提示把注册商处的 Nameserver 修改为 Cloudflare 分配的 Nameserver。
3. 等待域名区域状态变为 Active。

只有流量经过自己的 Cloudflare 域名区域，才能应用该区域的 WAF 规则。使用外部 DNS 且未由该 Cloudflare 区域代理的主机名，不应被当作已启用本文 WAF。

### 第二步：从 Pages 项目绑定自定义域名

进入：

```text
Workers & Pages > T-IMG > Custom domains > Set up a domain
```

填写 `img.example.com` 并按提示激活。应先在 Pages 项目中添加域名，再处理 DNS；只手工创建一个指向 `*.pages.dev` 的 CNAME、却没有在 Pages 中关联域名，可能导致 522。

如果域名区域与 Pages 项目位于同一 Cloudflare 账户，Pages 通常会创建对应 CNAME。到 `DNS > Records` 核对：

```text
类型：CNAME
名称：img
目标：<PROJECT>.pages.dev
代理状态：Proxied / 已代理（橙色云）
```

等待 Custom domains 状态变为 Active、HTTPS 证书正常后，再创建 WAF 规则。域名仍在验证时不要先启用 Access、全站重定向或会拦截 `/.well-known/acme-challenge/*` 的规则，以免影响证书验证。

官方参考：[Pages 自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)。

### 第三步：阻止通过 `*.pages.dev` 绕过 WAF

WAF 自定义规则属于自己的域名区域，只会检查发往自定义域名的流量；原始 `<PROJECT>.pages.dev` 不在该区域内。若生产 `pages.dev` 地址继续直接提供站点，攻击者可以跳过自定义域名上的 WAF。

在 Cloudflare 的 **Bulk Redirects** 创建重定向列表：

| 设置 | 值 |
|---|---|
| Source URL | `<PROJECT>.pages.dev` |
| Target URL | `https://img.example.com` |
| Status | `301` |
| Preserve query string | 开启 |
| Subpath matching | 开启 |
| Preserve path suffix | 开启 |

再使用该列表创建并启用 Bulk Redirect Rule。需要同时收口哈希预览地址和分支别名时可启用 **Include subdomains**；这样也会让 Preview 地址跳往生产域名，仍需在线测试 Preview 时，应改用 Cloudflare Access 保护 Preview，而不是无条件重定向所有子域名。

验证：

```bash
curl -I https://<PROJECT>.pages.dev/upload-login
```

应返回到 `https://img.example.com/upload-login` 的 301，并保留路径。官方参考：[将 `*.pages.dev` 重定向到自定义域名](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/)。

### 第四步：为上传登录添加 Managed Challenge

进入自己的域名区域，而不是 Pages 项目设置：

当前新版控制台路径：

```text
example.com > 安全性（Security） > 安全规则（Security rules）
            > 创建规则（Create rule） > 自定义规则（Custom rules）
```

Cloudflare 正在逐步切换新版安全控制台。如果仍使用旧版界面，对应路径是：

```text
example.com > Security > WAF > Custom rules > Create rule
```

规则名称建议填写 `T-IMG upload login managed challenge`。打开 Expression Editor，粘贴以下表达式，并把主机名替换为实际自定义域名：

```text
(http.host eq "img.example.com" and (
  http.request.uri.path in {"/upload-login" "/upload-login/" "/upload-login.html"}
  or (http.request.uri.path in {"/api/upload-auth/login" "/api/upload-auth/login/"}
      and http.request.method eq "POST")
))
```

动作选择：

```text
Managed Challenge / 托管质询
```

状态选择 **活动（Active）**，然后点击 **部署（Deploy）**。选择 **已禁用（Disabled）** 只会保存规则，Cloudflare 不会用它评估传入流量，也不会显示预期的人机验证。

这条规则的范围经过刻意收窄：

- 打开登录页及其 Pages 等价路径时，浏览器先完成人机验证。
- 直接跳过页面调用 `POST /api/upload-auth/login` 时同样会触发验证。
- 验证通过后，Cloudflare 写入 `cf_clearance`；随后用户仍须输入正确的 `UPLOAD_ACCESS_PASSWORD`，T-IMG 才会签发自己的上传会话 Cookie。
- 不匹配 `/i/*`、`/file/*`、`/assets/*`、`/_nuxt/*`、`POST /upload` 和会话查询，避免影响公开图片、静态资源和正常上传。

不要把规则简化为 `http.host eq "img.example.com"` 后对全站执行 Managed Challenge。全站质询会让博客外链图片、公开文件、监控工具和非浏览器客户端收到 HTML Challenge Page，也可能在 `cf_clearance` 过期后中断正在进行的 XHR 上传。

Cloudflare Free 计划目前也支持有限数量的 WAF Custom Rules 和 Managed Challenge。实际数量与可用字段可能随套餐变化，应以控制台和[WAF 可用性说明](https://developers.cloudflare.com/waf/)为准。创建方法见[WAF Custom Rules](https://developers.cloudflare.com/waf/custom-rules/create-dashboard/)。

### 第五步：设置人机验证保持时间

Managed Challenge 通过后，Cloudflare 使用 `cf_clearance` Cookie 记录验证状态。它与 T-IMG 的 `__Host-t_img_upload_session` Cookie 不相同：

| Cookie | 颁发方 | 证明内容 | 典型有效期 |
|---|---|---|---|
| `cf_clearance` | Cloudflare WAF | 浏览器已通过边缘人机验证 | 默认 30 分钟 |
| `__Host-t_img_upload_session` | T-IMG Pages Function | 用户已输入正确上传密码 | 默认 7 天 |

进入域名区域的 `Security > Settings > Challenge passage`。Cloudflare 默认 30 分钟，并建议通常使用 15–45 分钟；T-IMG 建议先保持 30 分钟。不要为了与 7 天上传会话对齐而盲目把 `cf_clearance` 延长到数天。

官方参考：[Challenge Passage](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/challenge-passage/)。

### 第六步：可选的边缘增强

以下措施不会读写 T-IMG 的 `img_url` KV：

1. **登录接口 Rate Limiting**：套餐允许时，只对 `/api/upload-auth/login` 创建 Rate Limiting Rule。先从宽松阈值开始并观察 Security Analytics；免费计划可使用一个规则，但字段、周期和动作受套餐限制。使用 Managed Challenge 比直接 Block 更不容易误伤共享出口 IP。
2. **后台 Managed Challenge**：在继续保留 `BASIC_USER`/`BASIC_PASS` 的前提下，可新建第二条规则保护管理页与 `/api/manage/*`。浏览器管理流程适用，依赖 Basic Auth 的自动化客户端可能无法处理 Challenge Page。
3. **Free Managed Ruleset**：免费计划通常已提供精简的托管规则集；新版控制台进入 `安全性 > 设置（Settings）`，筛选 **Web application exploits** 后核对 Cloudflare managed ruleset，旧版入口是 `Security > WAF > Managed rules`。若上传被误判，先看 Security Events，再只调整命中的具体规则，避免给 `/upload` 创建宽泛的 WAF 跳过。
4. **Bot Fight Mode**：免费计划可以启用，但它不能按路径排除。若公开图片、搜索引擎、监控或合法客户端出现误判，应根据 Security Events 关闭；不要在无法接受全域影响时直接开启。

Rate Limiting 参考：[规则与套餐限制](https://developers.cloudflare.com/waf/rate-limiting-rules/)。Cloudflare DDoS 防护在所有计划中自动运行，无需为 T-IMG 单独创建 DDoS 规则。

本文采用的是 **WAF Managed Challenge**，不需要改 T-IMG 页面代码，也不需要 Turnstile Site Key/Secret。嵌入式 Turnstile 是另一种方案；如果未来把 Turnstile 控件直接放到登录表单，必须同步修改后端并调用 Siteverify，不能只在前端显示控件。

### 第七步：验收与回退

使用无痕窗口逐项验证：

1. 打开自定义域名 `/upload-login`，首次访问应出现 Cloudflare 验证或由 Managed Challenge 自动判定通过。
2. 验证通过后仍必须输入正确上传密码；错误密码继续由 T-IMG 返回 401。
3. 直接请求自定义域名的 `POST /api/upload-auth/login`，没有有效 clearance 时应被 Cloudflare 拦截。
4. 登录后刷新、退出和重新登录正常；上传仍返回 `/i/` 短链。
5. 未登录窗口能直接打开 `/i/:short-code.ext` 和 `/file/:id`，不应出现人机验证。
6. 原始 `*.pages.dev` 相同路径必须重定向到自定义域名，不能继续显示可用的登录页。
7. 在 `Security > Events` 检查命中规则、动作和 Ray ID，不记录或公开密码、Cookie、Token。

如果出现验证循环、上传接口返回 HTML、公开图片被质询或大量误判：

1. 先停用新建的 WAF 自定义规则，不删除 T-IMG 后端密码保护。
2. 确认站点恢复后，从 Security Events 找到具体命中路径。
3. 收窄表达式或恢复本文推荐规则，再重新启用。
4. Bulk Redirect 可继续保留；若确需回退域名，先确认 Pages 自定义域名和证书状态，不要直接删除 `img_url`、Secret 或稳定部署。

WAF、Bot Fight Mode 与 Rate Limiting 的动作发生在不同阶段；一个 Block 或 Managed Challenge 可能使请求不再进入后续阶段。排错时以 Security Events 显示的实际 Service 和 Rule 为准。

## 管理后台认证

```env
BASIC_USER=your_admin_username
BASIC_PASS=your_strong_admin_password
```

生产环境强烈建议同时设置两项。当前实现未设置 `BASIC_USER` 时会跳过 Basic Auth；如果改用 Cloudflare Access，应完整保护 `/admin*` 和 `/api/manage/*`，并验证静态管理页面与所有变更接口都无法匿名访问。不要在浏览器截图、日志或工单中暴露 Authorization Header。

## 可选内容审核与运行模式

```env
ModerateContentApiKey=your_api_key
WhiteList_Mode=false
```

设置审核 Key 后，首次访问未分类图片时会调用 ModerateContent。白名单模式只有在字符串严格等于 `true` 且绑定 KV 时生效。外部审核失败时当前实现倾向继续返回内容，上线前应根据安全策略评估。

## 生产注意事项

- 不把任何真实值提交到 `.env.example`、README、工作流、源码或测试。
- Telegram 文件大小、Cloudflare Functions/KV 配额和外部服务限制会变化，应在生产前查阅对应官方文档。
- KV 删除只移除管理记录，不保证删除 Telegram 上的文件。
- 管理接口已移除敏感调试日志并修复重命名参数；生产环境仍须启用强认证或 Cloudflare Access。
- 自定义域名启用 WAF 后必须把生产 `*.pages.dev` 收口到自定义域名，避免从默认域名绕过区域安全规则。
- WAF 人机验证只保护登录入口；T-IMG 后端密码、上传会话、Fail closed 和后台认证仍必须保留。
- 不把本地 `data/` 或 `.wrangler/` 上传到仓库或生产。
- 部署后使用无痕浏览器验证 `/`、`/index`、`/index.html`、`/markdown-upload` 和 `/markdown-upload.html` 均先跳转到 `/upload-login`；不要删除 `_routes.json` 中的等价路径规则。
- 验证错误密码、正确密码、刷新保持、退出、会话过期和直接 `POST /upload`；成功上传应返回 `/i/` 短链，并确认该短链、已有 `/file/:id` 及后台管理均未被上传认证重定向。
- 确认旧静态路径返回 301；不要删除 `_redirects` 中仍有外部调用方使用的兼容规则。

## 重新部署条件

Functions 代码、静态文件、环境变量、KV 绑定、兼容日期或 Pages 项目设置变化后需要重新部署。只修改本地 `.env` 不会自动影响 Cloudflare。

如果项目以前配置过 `UPLOAD_AUTH_KV`，应先部署包含本次简化代码的版本并完成登录与上传验收，再从 Pages 项目的 Bindings 中删除 `UPLOAD_AUTH_KV`。确认没有其他项目使用对应 Namespace 后，可在 Workers KV 页面删除旧的认证计数 Namespace；该操作不会影响必需的 `img_url` 图片数据。不要删除或改名 `img_url`。

## 常见错误排查

- 上传页面或接口返回 503：确认 Production 环境中的上传密码、会话密钥、`img_url` 及两项 Telegram 变量均已配置，并在修改后创建新部署。Functions 日志只会列出缺失或类型错误的配置名称，不会输出值；`telegram_not_configured` 对应 Telegram 变量，`image_index_not_configured` 对应 `img_url` KV 绑定。
- 上传返回 401：会话不存在、已过期或签名密钥已变更，重新访问 `/upload-login` 验证。
- 登录返回 401：访问密码不正确，不会写入错误次数；请从密码管理器复制完整密码并检查是否包含多余空格。
- 上传返回 413：文件超过 T-IMG 默认或自定义上限；不要把 `MAX_UPLOAD_SIZE_BYTES` 设置得高于 20 MiB。
- 上传返回 502：确认 Bot 权限、目标 ID、Telegram 可用性和文件类型，并检查脱敏后的 Functions 状态日志。
- `/i/` 短链返回 404：对应短码记录不存在，确认没有从 `img_url` 删除该条目，也不要手工修改短码。
- `/i/` 短链返回 503：短链无法读取 `img_url`；确认 Production 的 KV 绑定名称和目标命名空间正确，并在变更后重新部署。旧式 `/file/` 地址不依赖短码映射。
- 后台提示已禁用：确认 `img_url` 位于 Bindings、类型为 KV Namespace、名称大小写完全一致，并在绑定后重新部署；普通文本变量不属于 KV 绑定。
- 后台持续 401：确认用户名和密码同时配置，浏览器未缓存旧凭据；不要把真实凭据复制到工单。
- 自定义域名没有人机验证：确认 DNS 为已代理、请求主机名与 WAF 表达式一致，并确认访问的不是仍可用的 `*.pages.dev` 地址。
- 登录或上传收到 Cloudflare HTML 页面：WAF 规则范围过宽或 `cf_clearance` 已失效；先在 Security Events 确认命中规则，不要把 `/upload`、`/api/upload-auth/session` 或全站公开路径纳入登录质询。
- 人机验证反复循环：允许站点 Cookie 和 JavaScript，暂时排除隐私扩展影响，并检查 Challenge Passage、浏览器时间及 Security Events。
- 文件首次加载慢：可能正在查询 Telegram 路径、初始化 KV 或调用内容审核。
- 本地找不到 `mocha`/`wrangler`：执行 `npm ci`，不要依赖仓库中已跟踪的不完整依赖目录。
- 生产与本地行为不同：核对 Cloudflare 控制台中的兼容日期、环境变量和 KV 绑定；仓库内本地日期不会自动覆盖生产配置。
