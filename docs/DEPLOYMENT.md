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

当前脚本在 `http://localhost:8080` 启动 Wrangler，固定本地兼容日期，绑定本地持久化 KV `img_url` 和 `UPLOAD_AUTH_KV`，并注入仅用于本地测试的后台与上传认证值。不得把脚本中的测试凭据复用于生产。Wrangler 会将本地状态写入已忽略的 `data/`。

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

- `UPLOAD_ACCESS_PASSWORD` 至少 12 字符，必须保存为加密 Secret。
- `UPLOAD_SESSION_SECRET` 至少 32 字符，建议使用密码管理器或系统安全随机源生成，必须与访问密码不同并保存为 Secret。
- `UPLOAD_SESSION_MAX_AGE` 可作为普通变量，默认 604800 秒（7 天），允许范围 300 至 2592000 秒（30 天）。修改签名密钥会立即使已有会话失效。

另建一个只用于登录失败计数的 KV 命名空间，并绑定为：

```text
变量名称：UPLOAD_AUTH_KV
绑定类型：KV Namespace
目标：选择专用于 T-IMG 上传认证限流的命名空间
```

不要把它与 `img_url` 共用，否则认证计数会污染图片索引。登录按匿名化客户端地址计数，10 分钟内第 5 次失败开始返回 429。KV 具有最终一致性，因此这是基础限流；高风险部署应叠加 Cloudflare WAF/Rate Limiting 或 Access。缺少密码、会话密钥时上传页面和接口返回 503；缺少 `UPLOAD_AUTH_KV` 时新登录返回 503，已有有效签名会话仍可使用。

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

该值就是访问者在 `/upload-login` 页面需要输入的密码。代码要求至少 12 字符；生产环境建议使用密码管理器生成并保存至少 20 字符的随机密码，不要使用姓名、生日、手机号或其他网站已使用的密码。

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

#### 第五步：创建并绑定登录限流 KV

1. 在 Cloudflare Dashboard 的 Workers KV 页面选择 **Create instance**。
2. Namespace 名称可填写 `t-img-upload-auth`；该资源名称可以自定义。
3. 回到 `Workers & Pages > T-IMG > Settings > Bindings`。
4. 选择 **Add > KV Namespace**。
5. Variable name 必须严格填写 `UPLOAD_AUTH_KV`。
6. 选择刚创建的 `t-img-upload-auth` Namespace 并保存。

KV 资源名称可以自定义，但代码读取的绑定名称必须是 `UPLOAD_AUTH_KV`。不要选择现有的 `img_url`；前者保存错误登录计数，后者保存图片元数据。需要使用 Preview 部署时，建议为 Preview 单独创建并绑定 KV，避免测试计数影响生产。

#### 第六步：设置失败关闭并重新部署

进入：

```text
Workers & Pages > T-IMG > Settings > Runtime > Fail open / closed
```

选择 **Fail closed**。认证 Function 无法执行或免费配额耗尽时，Cloudflare 将返回错误页面，而不是绕过认证继续提供静态上传页面。完成 Secret、变量和 KV 绑定后重新部署最新 `main`；生产环境至少需要配置 Production，使用 Preview 时还需单独检查 Preview 配置。

Cloudflare 官方参考：[Pages Functions 变量与 Secret](https://developers.cloudflare.com/pages/functions/bindings/)、[Workers KV 创建与绑定](https://developers.cloudflare.com/kv/get-started/)、[Pages Functions Fail closed](https://developers.cloudflare.com/pages/functions/routing/)。

#### 第七步：部署后验收

1. 使用无痕窗口打开 `/` 或 `/markdown-upload.html`，应先跳转到 `/upload-login`。
2. 输入与 `UPLOAD_ACCESS_PASSWORD` 不同的密码，应拒绝进入。
3. 输入完全相同的密码，应进入原上传界面并可正常上传。
4. 刷新页面，在 `UPLOAD_SESSION_MAX_AGE` 有效期内应保持登录。
5. 点击“退出上传”后，再次访问上传页面应重新要求输入密码。
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
- 不把本地 `data/` 或 `.wrangler/` 上传到仓库或生产。
- 部署后使用无痕浏览器验证 `/`、`/index`、`/index.html`、`/markdown-upload` 和 `/markdown-upload.html` 均先跳转到 `/upload-login`；不要删除 `_routes.json` 中的等价路径规则。
- 验证错误密码、正确密码、刷新保持、退出、会话过期和直接 `POST /upload`；成功上传应返回 `/i/` 短链，并确认该短链、已有 `/file/:id` 及后台管理均未被上传认证重定向。
- 确认旧静态路径返回 301；不要删除 `_redirects` 中仍有外部调用方使用的兼容规则。

## 重新部署条件

Functions 代码、静态文件、环境变量、KV 绑定、兼容日期或 Pages 项目设置变化后需要重新部署。只修改本地 `.env` 不会自动影响 Cloudflare。

## 常见错误排查

- 上传页面或接口返回 503：确认 Production 环境中的上传密码、会话密钥、`UPLOAD_AUTH_KV`、`img_url` 及两项 Telegram 变量均已配置，并在修改后创建新部署。Functions 日志只会列出缺失或类型错误的配置名称，不会输出值；`telegram_not_configured` 对应 Telegram 变量，`image_index_not_configured` 对应 `img_url` KV 绑定。
- 上传返回 401：会话不存在、已过期或签名密钥已变更，重新访问 `/upload-login` 验证。
- 登录返回 429：同一客户端连续失败达到限额，等待 `Retry-After` 指示的时间后重试，不要清空生产 KV 绕过保护。
- 上传返回 413：文件超过 T-IMG 默认或自定义上限；不要把 `MAX_UPLOAD_SIZE_BYTES` 设置得高于 20 MiB。
- 上传返回 502：确认 Bot 权限、目标 ID、Telegram 可用性和文件类型，并检查脱敏后的 Functions 状态日志。
- `/i/` 短链返回 404：对应短码记录不存在，确认没有从 `img_url` 删除该条目，也不要手工修改短码。
- `/i/` 短链返回 503：短链无法读取 `img_url`；确认 Production 的 KV 绑定名称和目标命名空间正确，并在变更后重新部署。旧式 `/file/` 地址不依赖短码映射。
- 后台提示已禁用：确认 `img_url` 位于 Bindings、类型为 KV Namespace、名称大小写完全一致，并在绑定后重新部署；普通文本变量不属于 KV 绑定。
- 后台持续 401：确认用户名和密码同时配置，浏览器未缓存旧凭据；不要把真实凭据复制到工单。
- 文件首次加载慢：可能正在查询 Telegram 路径、初始化 KV 或调用内容审核。
- 本地找不到 `mocha`/`wrangler`：执行 `npm ci`，不要依赖仓库中已跟踪的不完整依赖目录。
- 生产与本地行为不同：核对 Cloudflare 控制台中的兼容日期、环境变量和 KV 绑定；仓库内本地日期不会自动覆盖生产配置。
