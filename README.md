# T-IMG

English | [简体中文](README.zh-CN.md)

T-IMG is an independently maintained file and image hosting project built with Cloudflare Pages Functions, Telegram Bot API, and Cloudflare KV-backed image metadata.

## Features

- Uploads files to Telegram, returns same-origin `/i/:short-code.ext` links for new uploads, and keeps existing `/file/:id` URLs compatible.
- Protects upload pages and `POST /upload` with a backend-verified password, signed HttpOnly session cookie, and KV-backed login throttling.
- Limits uploads to 20 MiB by default so files remain retrievable through the public Bot API.
- Stores image metadata in the required `img_url` KV binding and supports gallery management, blocklists, allowlists, and content review.
- Provides optional HTTP Basic authentication for management routes.
- Removes third-party telemetry and avoids exposing credentials, request headers, or external-service error details.
- Keeps legacy static URLs and camelCase management APIs compatible while using standardized canonical names.

## Repository Layout

| Path | Purpose |
|---|---|
| `index.html` | Primary upload page |
| `markdown-upload.html` | Alternate upload page with Markdown output |
| `upload-login.html` | Upload access login page |
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

`npm run ci-test` starts a local Wrangler Pages environment and runs the complete suite, including an HTTP login, session, logout, and upload-route smoke flow. Local management and upload-auth values in `package.json` are test-only and must never be reused in production.

## Configuration

| Name | Required | Cloudflare type | Purpose |
|---|---|---|---|
| `TG_Bot_Token` | Yes | Secret | Telegram Bot Token |
| `TG_Chat_ID` | Yes | Text | Target channel or group ID |
| `MAX_UPLOAD_SIZE_BYTES` | No | Text | Upload limit up to 20 MiB |
| `UPLOAD_ACCESS_PASSWORD` | Yes | Secret | Password visitors enter on the upload login page |
| `UPLOAD_SESSION_SECRET` | Yes | Secret | Backend-only HMAC session signing key |
| `UPLOAD_SESSION_MAX_AGE` | No | Text | Session lifetime in seconds; defaults to 7 days |
| `UPLOAD_AUTH_KV` | Yes | KV namespace binding | Dedicated storage for failed-login throttling |
| `img_url` | Yes | KV namespace binding | Short-code mappings, image metadata, management, and list data |
| `BASIC_USER` | Recommended | Text | Management Basic Auth username |
| `BASIC_PASS` | Recommended | Secret | Management Basic Auth password |
| `ModerateContentApiKey` | No | Secret | Content review for legacy Telegraph files |
| `WhiteList_Mode` | No | Text | Allowlist-only display mode when set to `true` |

Copy variable names from [`.env.example`](.env.example), but configure real production values in Cloudflare Pages. Never commit real credentials. Full instructions are in the [deployment guide](docs/DEPLOYMENT.md).

### Upload access quick setup

The site owner chooses the password visitors enter on `/upload-login` and stores it as the encrypted Cloudflare Secret `UPLOAD_ACCESS_PASSWORD`. Configure a different random encrypted Secret as `UPLOAD_SESSION_SECRET`, set `UPLOAD_SESSION_MAX_AGE=604800` for a seven-day session, bind the required image metadata KV as `img_url`, bind a separate throttling KV as `UPLOAD_AUTH_KV`, and set Pages Functions to fail closed before redeploying. The session secret is an internal signing key and is never entered by visitors. The [deployment guide](docs/DEPLOYMENT.md) includes the dashboard walkthrough, safe key-generation commands, and acceptance checks.

## Public Routes

- `POST /upload`
- `POST /api/upload-auth/login`
- `POST /api/upload-auth/logout`
- `GET /api/upload-auth/session`
- `GET|HEAD /i/:short-code.ext`
- `GET|HEAD /file/:id`
- `/api/manage/list`
- `/api/manage/{block|white|delete|edit-name|toggle-like}/:id`

Legacy static paths are redirected through [`_redirects`](_redirects). Legacy `editName` and `toggleLike` APIs remain as compatibility aliases.

Upload pages and `POST /upload` require an upload session. A valid configured management Basic Auth session remains accepted by `POST /upload` so gallery uploads continue to work. New uploads use an automatically generated 12-character random code; custom short-link names are not supported. The code and full Telegram file identifier share the existing `img_url` record, so no additional KV namespace is required and a normal short-link request performs one KV read. Existing `/file/:id` links remain public.

## GitHub Actions

The CI workflow runs on every push to `main`, every Pull Request targeting `main`, and manual dispatch. It uses Node.js 22, installs and audits dependencies, starts Wrangler, and runs the full regression suite. Dependabot checks npm and GitHub Actions dependencies monthly through reviewable Pull Requests.

## Security and Contributions

Read [SECURITY.md](SECURITY.md) before reporting vulnerabilities and [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes. Do not disclose secrets or production data in public issues.

## Acknowledgements

Thanks to [cf-pages/Telegraph-Image](https://github.com/cf-pages/Telegraph-Image) and its contributors for the original project foundation. T-IMG is maintained as an independent repository and does not use a fork, remote, or automatic synchronization relationship.

## License

The repository retains the [CC0 1.0 Universal license](LICENSE).
