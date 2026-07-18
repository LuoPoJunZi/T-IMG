# T-IMG

English | [简体中文](README.zh-CN.md)

T-IMG is an independently maintained file and image hosting project built with Cloudflare Pages Functions, Telegram Bot API, and optional Cloudflare KV management.

## Features

- Uploads files to Telegram and serves stable same-origin `/file/:id` URLs.
- Limits uploads to 20 MiB by default so files remain retrievable through the public Bot API.
- Supports optional KV-backed metadata, gallery management, blocklists, allowlists, and content review.
- Provides optional HTTP Basic authentication for management routes.
- Removes third-party telemetry and avoids exposing credentials, request headers, or external-service error details.
- Keeps legacy static URLs and camelCase management APIs compatible while using standardized canonical names.

## Repository Layout

| Path | Purpose |
|---|---|
| `index.html` | Primary upload page |
| `markdown-upload.html` | Alternate upload page with Markdown output |
| `admin.html` | Management entry |
| `admin-gallery.html` | Gallery management page |
| `admin-waterfall.html` | Waterfall view |
| `assets/` | Images, icons, and styles |
| `functions/` | Cloudflare Pages Functions |
| `test/` | Node.js regression tests |
| `docs/` | Requirements, decisions, deployment, and maintenance records |

See [repository conventions](docs/REPOSITORY_CONVENTIONS.md) and the [project overview](docs/PROJECT_OVERVIEW.md) for details.

## Requirements

- Node.js 22
- npm with lockfile support
- A Cloudflare account
- A Telegram bot with permission to post to the target channel or group

## Local Development

```bash
npm ci
npm test
npm run ci-test
npm start
```

`npm run ci-test` starts a local Wrangler Pages environment and runs the complete test suite. Local Basic Auth values in `package.json` are test-only and must never be reused in production.

## Configuration

| Name | Required | Purpose |
|---|---|---|
| `TG_Bot_Token` | Yes | Telegram Bot Token |
| `TG_Chat_ID` | Yes | Target channel or group ID |
| `MAX_UPLOAD_SIZE_BYTES` | No | Upload limit up to 20 MiB |
| `img_url` | No | Cloudflare KV namespace binding |
| `BASIC_USER`, `BASIC_PASS` | Recommended | Management Basic Auth |
| `ModerateContentApiKey` | No | Content review for legacy Telegraph files |
| `WhiteList_Mode` | No | Allowlist-only display mode when set to `true` |

Copy variable names from [`.env.example`](.env.example), but configure real production values in Cloudflare Pages. Never commit real credentials. Full instructions are in the [deployment guide](docs/DEPLOYMENT.md).

## Public Routes

- `POST /upload`
- `GET|HEAD /file/:id`
- `/api/manage/list`
- `/api/manage/{block|white|delete|edit-name|toggle-like}/:id`

Legacy static paths are redirected through [`_redirects`](_redirects). Legacy `editName` and `toggleLike` APIs remain as compatibility aliases.

## GitHub Actions

The CI workflow runs on every push to `main`, every Pull Request targeting `main`, and manual dispatch. It uses Node.js 22, installs and audits dependencies, starts Wrangler, and runs the full regression suite. Dependabot checks npm and GitHub Actions dependencies monthly through reviewable Pull Requests.

## Security and Contributions

Read [SECURITY.md](SECURITY.md) before reporting vulnerabilities and [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes. Do not disclose secrets or production data in public issues.

## Acknowledgements

Thanks to [cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image) and its contributors for the original project foundation. T-IMG is maintained as an independent repository and does not use a fork, remote, or automatic synchronization relationship.

## License

The repository retains the [CC0 1.0 Universal license](LICENSE).
