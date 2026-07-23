# T-IMG

English | [简体中文](README.zh-CN.md)

T-IMG is an independently maintained file and image hosting project built with Cloudflare Pages Functions, Telegram Bot API, and Cloudflare KV-backed image metadata.

## Features

- Uploads files to Telegram, returns same-origin `/i/:short-code.ext` links for new uploads, and keeps existing `/file/:id` URLs compatible.
- Protects upload pages and `POST /upload` with a backend-verified password and a signed HttpOnly session cookie.
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
| `img_url` | Yes | KV namespace binding | Short-code mappings, image metadata, management, and list data |
| `BASIC_USER` | Recommended | Text | Management Basic Auth username |
| `BASIC_PASS` | Recommended | Secret | Management Basic Auth password |
| `ModerateContentApiKey` | No | Secret | Content review for legacy Telegraph files |
| `WhiteList_Mode` | No | Text | Allowlist-only display mode when set to `true` |

Copy variable names from [`.env.example`](.env.example), but configure real production values in Cloudflare Pages. Never commit real credentials. Full instructions are in the [deployment guide](docs/DEPLOYMENT.md).

### Upload access quick setup

The site owner chooses the password visitors enter on `/upload-login` and stores it as the encrypted Cloudflare Secret `UPLOAD_ACCESS_PASSWORD`. Configure a different random encrypted Secret as `UPLOAD_SESSION_SECRET`, set `UPLOAD_SESSION_MAX_AGE=604800` for a seven-day session, bind the required image metadata KV as `img_url`, and set Pages Functions to fail closed before redeploying. The session secret is an internal signing key and is never entered by visitors. No `UPLOAD_AUTH_KV` binding is needed: failed passwords are rejected with `401` without storing attempt counters.

Generate the two values separately in Windows PowerShell. The first command creates a 32-character, 192-bit random upload password:

```powershell
$uploadPasswordBytes = New-Object byte[] 24
$uploadPasswordGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$uploadPasswordGenerator.GetBytes($uploadPasswordBytes)
[Convert]::ToBase64String($uploadPasswordBytes)
$uploadPasswordGenerator.Dispose()
```

Run this separate command for a 64-character, 384-bit session secret:

```powershell
$sessionSecretBytes = New-Object byte[] 48
$sessionSecretGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$sessionSecretGenerator.GetBytes($sessionSecretBytes)
[Convert]::ToBase64String($sessionSecretBytes)
$sessionSecretGenerator.Dispose()
```

Store both outputs as different Cloudflare Secrets and in a password manager. Never commit, publish, screenshot, or reuse them. Although the code accepts passwords from 12 characters, production deployments should use at least 24 random characters because T-IMG intentionally does not store failed-login counters. The [deployment guide](docs/DEPLOYMENT.md) includes the complete dashboard walkthrough and acceptance checks.

### Custom domain and Cloudflare WAF hardening

For an Internet-facing deployment, bind a hostname from a Cloudflare-managed zone, such as `img.example.com`, under `Workers & Pages > T-IMG > Custom domains`. Keep the Pages-created DNS record proxied. Zone WAF rules do not protect the original `*.pages.dev` hostname, so redirect the production `*.pages.dev` address to the custom hostname with a Cloudflare Bulk Redirect before treating WAF as an effective security layer.

In the current dashboard, open the domain zone and go to `Security > Security rules > Create rule > Custom rules`. Older dashboard layouts show the same feature under `Security > WAF > Custom rules`. Replace the example hostname and select **Managed Challenge**:

```text
(http.host eq "img.example.com" and (
  http.request.uri.path in {"/upload-login" "/upload-login/" "/upload-login.html"}
  or (http.request.uri.path in {"/api/upload-auth/login" "/api/upload-auth/login/"}
      and http.request.method eq "POST")
))
```

Set **Status** to **Active** before selecting **Deploy**; **Disabled** only stores the rule and does not evaluate incoming traffic. The rule challenges the login entry and direct password submissions while leaving `/i/*` and `/file/*` publicly embeddable. The Cloudflare `cf_clearance` cookie and the T-IMG upload-session cookie are separate layers; passing the challenge never replaces the backend password. A 30-minute Challenge Passage is a practical default. Optionally add a path-scoped rate limiting rule for `/api/upload-auth/login` and enable Bot Fight Mode only after checking Security Events for false positives. Do not challenge all paths globally, because that can break public image embedding, API clients, and uploads whose clearance has expired. Full setup, bypass prevention, testing, and rollback instructions are in the [deployment guide](docs/DEPLOYMENT.md).

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
