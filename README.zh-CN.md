# T-IMG

[English](README.md) | 简体中文

T-IMG 是基于 Cloudflare Pages Functions、Telegram Bot API 和 Cloudflare KV 图片元数据构建的独立文件与图片托管项目。

## 主要能力

- 将文件上传到 Telegram，新上传自动返回同域 `/i/:short-code.ext` 短链，并继续兼容已有 `/file/:id` 地址。
- 使用后端校验密码、签名 HttpOnly 会话 Cookie 和 KV 登录限流保护上传页面及 `POST /upload`。
- 默认限制单文件 20 MiB，确保可通过公共 Bot API 取回。
- 使用必需的 `img_url` KV 保存图片元数据，并提供画廊管理、黑白名单和内容审核。
- 管理接口可启用 HTTP Basic Auth。
- 不加载第三方遥测，不向客户端暴露凭据、请求头或内部服务错误。
- 主入口采用规范命名，同时兼容旧静态路径和驼峰式管理 API。

## 仓库结构

| 路径 | 用途 |
|---|---|
| `index.html` | 主上传页面 |
| `markdown-upload.html` | 提供 Markdown 输出的备用上传页面 |
| `upload-login.html` | 上传访问验证页面 |
| `admin.html` | 后台管理入口 |
| `admin-gallery.html` | 画廊管理页面 |
| `admin-waterfall.html` | 瀑布流页面 |
| `assets/` | 图片、图标和样式 |
| `functions/` | Cloudflare Pages Functions |
| `test/` | Node.js 回归测试 |
| `docs/` | 需求、决策、部署和维护记录 |

详细规则见[仓库命名规范](docs/REPOSITORY_CONVENTIONS.md)和[项目概览](docs/PROJECT_OVERVIEW.md)。

## 环境要求

- Node.js 22
- 支持锁文件的 npm
- Cloudflare 账户
- 有权向目标频道或群组发送内容的 Telegram Bot

## 本地开发

```bash
npm ci
npm test
npm run ci-test
npm start
```

`npm run ci-test` 会启动本地 Wrangler Pages 环境并执行完整测试，其中包含真实 HTTP 登录、会话、退出和上传路由冒烟流程。写在 `package.json` 中的本地后台与上传认证值仅用于测试，禁止作为生产凭据。

## 配置

| 名称 | 必需性 | Cloudflare 类型 | 用途 |
|---|---|---|---|
| `TG_Bot_Token` | 必需 | 密钥 | Telegram Bot Token |
| `TG_Chat_ID` | 必需 | 文本 | 目标频道或群组 ID |
| `MAX_UPLOAD_SIZE_BYTES` | 可选 | 文本 | 不超过 20 MiB 的上传限制 |
| `UPLOAD_ACCESS_PASSWORD` | 必需 | 密钥 | 访问者在上传登录页输入的密码 |
| `UPLOAD_SESSION_SECRET` | 必需 | 密钥 | 仅供后端使用的 HMAC 会话签名密钥 |
| `UPLOAD_SESSION_MAX_AGE` | 可选 | 文本 | 会话有效期秒数，默认 7 天 |
| `UPLOAD_AUTH_KV` | 必需 | KV Namespace 绑定 | 专用于登录失败限流的 KV |
| `img_url` | 必需 | KV Namespace 绑定 | 短码映射、图片元数据、后台管理和名单数据 |
| `BASIC_USER` | 建议配置 | 文本 | 后台 Basic Auth 用户名 |
| `BASIC_PASS` | 建议配置 | 密钥 | 后台 Basic Auth 密码 |
| `ModerateContentApiKey` | 可选 | 密钥 | 旧 Telegraph 文件的内容审核 |
| `WhiteList_Mode` | 可选 | 文本 | 设置为 `true` 时启用白名单模式 |

变量名称可参考 [`.env.example`](.env.example)，真实生产值必须在 Cloudflare Pages 中配置，禁止提交到仓库。完整步骤见[部署说明](docs/DEPLOYMENT.md)。

### 上传访问密码快速配置

上传页面使用一个由站点所有者自行设置、由访问者在前台输入的密码：

1. 在 Cloudflare Pages 项目的 `Settings > Variables and Secrets` 中新增加密 Secret：`UPLOAD_ACCESS_PASSWORD`，值填写你希望用户输入的强密码。
2. 再新增加密 Secret：`UPLOAD_SESSION_SECRET`，值使用独立的长随机字符串。它只供后端签名会话，用户不需要知道，也不能与访问密码相同。
3. 新增普通变量 `UPLOAD_SESSION_MAX_AGE=604800`，表示登录状态保持 7 天。
4. 创建图片元数据 Workers KV，并以变量名 `img_url` 绑定到 Pages 项目。它是必需绑定，不能添加成普通文本变量。
5. 再创建一个独立 Workers KV，并以变量名 `UPLOAD_AUTH_KV` 绑定到 Pages 项目，用于错误密码限流；不要与 `img_url` 共用。
6. 将 Pages Functions 的 Fail open / closed 设置为 `Fail closed`，然后重新部署。

配置完成后，用户打开上传页面会先进入 `/upload-login`；输入与 `UPLOAD_ACCESS_PASSWORD` 相同的密码后才能使用上传界面。密码错误、会话过期或主动退出后都会重新禁止访问。随机密钥生成方法、Cloudflare 控制台逐步操作和验收清单见[部署说明](docs/DEPLOYMENT.md)。

## 公开路由

- `POST /upload`
- `POST /api/upload-auth/login`
- `POST /api/upload-auth/logout`
- `GET /api/upload-auth/session`
- `GET|HEAD /i/:short-code.ext`
- `GET|HEAD /file/:id`
- `/api/manage/list`
- `/api/manage/{block|white|delete|edit-name|toggle-like}/:id`

旧静态路径通过 [`_redirects`](_redirects) 重定向；旧 `editName` 和 `toggleLike` API 继续作为兼容入口。

上传页面和 `POST /upload` 必须具有上传会话。为保持画廊批量上传兼容，`POST /upload` 也接受已正确配置并验证通过的后台 Basic Auth。新上传使用系统自动生成的 12 位随机短码，不提供自定义命名；短码和完整 Telegram 文件标识保存在现有 `img_url` 中，不需要新增 KV 命名空间。普通短链访问只读取一次该 KV 记录，已有 `/file/:id` 链接继续公开访问。

## GitHub Actions

CI 会在每次推送 `main`、针对 `main` 的 Pull Request 以及手动触发时运行。流程使用 Node.js 22，安装并审计依赖，启动 Wrangler 并执行完整回归测试。Dependabot 每月通过可审查的 Pull Request 检查 npm 和 GitHub Actions 依赖更新。

## 安全与贡献

报告漏洞前请阅读 [SECURITY.md](SECURITY.md)，提交改动前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。禁止在公开 Issue 中披露密钥或生产数据。

## 致谢

感谢 [cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image) 及其贡献者提供的原始项目基础。T-IMG 作为独立仓库维护，不建立 fork、远程或自动同步关系。

## 许可证

仓库继续使用 [CC0 1.0 Universal](LICENSE)。
