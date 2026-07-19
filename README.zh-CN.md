# T-IMG

[English](README.md) | 简体中文

T-IMG 是基于 Cloudflare Pages Functions、Telegram Bot API 和可选 Cloudflare KV 管理能力构建的独立文件与图片托管项目。

## 主要能力

- 将文件上传到 Telegram，并通过同域 `/file/:id` 地址访问。
- 使用后端校验密码、签名 HttpOnly 会话 Cookie 和 KV 登录限流保护上传页面及 `POST /upload`。
- 默认限制单文件 20 MiB，确保可通过公共 Bot API 取回。
- 可选 KV 元数据、画廊管理、黑白名单和内容审核。
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

`npm run ci-test` 会启动本地 Wrangler Pages 环境并执行完整测试。写在 `package.json` 中的本地后台与上传认证值仅用于测试，禁止作为生产凭据。

## 配置

| 名称 | 必需性 | 用途 |
|---|---|---|
| `TG_Bot_Token` | 必需 | Telegram Bot Token |
| `TG_Chat_ID` | 必需 | 目标频道或群组 ID |
| `MAX_UPLOAD_SIZE_BYTES` | 可选 | 不超过 20 MiB 的上传限制 |
| `UPLOAD_ACCESS_PASSWORD` | 必需 | 上传页面访问密码，必须配置为 Cloudflare Secret |
| `UPLOAD_SESSION_SECRET` | 必需 | HMAC 会话签名密钥，必须配置为 Cloudflare Secret |
| `UPLOAD_SESSION_MAX_AGE` | 可选 | 会话有效期秒数，默认 7 天 |
| `UPLOAD_AUTH_KV` | 必需 | 专用于登录失败限流的 KV 绑定 |
| `img_url` | 可选 | Cloudflare KV 命名空间绑定 |
| `BASIC_USER`、`BASIC_PASS` | 建议配置 | 后台 Basic Auth |
| `ModerateContentApiKey` | 可选 | 旧 Telegraph 文件的内容审核 |
| `WhiteList_Mode` | 可选 | 设置为 `true` 时启用白名单模式 |

变量名称可参考 [`.env.example`](.env.example)，真实生产值必须在 Cloudflare Pages 中配置，禁止提交到仓库。完整步骤见[部署说明](docs/DEPLOYMENT.md)。

## 公开路由

- `POST /upload`
- `POST /api/upload-auth/login`
- `POST /api/upload-auth/logout`
- `GET /api/upload-auth/session`
- `GET|HEAD /file/:id`
- `/api/manage/list`
- `/api/manage/{block|white|delete|edit-name|toggle-like}/:id`

旧静态路径通过 [`_redirects`](_redirects) 重定向；旧 `editName` 和 `toggleLike` API 继续作为兼容入口。

上传页面和 `POST /upload` 必须具有上传会话。为保持画廊批量上传兼容，`POST /upload` 也接受已正确配置并验证通过的后台 Basic Auth；已有 `/file/:id` 链接继续公开访问。

## GitHub Actions

CI 会在每次推送 `main`、针对 `main` 的 Pull Request 以及手动触发时运行。流程使用 Node.js 22，安装并审计依赖，启动 Wrangler 并执行完整回归测试。Dependabot 每月通过可审查的 Pull Request 检查 npm 和 GitHub Actions 依赖更新。

## 安全与贡献

报告漏洞前请阅读 [SECURITY.md](SECURITY.md)，提交改动前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。禁止在公开 Issue 中披露密钥或生产数据。

## 致谢

感谢 [cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image) 及其贡献者提供的原始项目基础。T-IMG 作为独立仓库维护，不建立 fork、远程或自动同步关系。

## 许可证

仓库继续使用 [CC0 1.0 Universal](LICENSE)。
