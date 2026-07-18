# Security Policy

## Supported Version

安全修复只面向 `main` 的最新版本。旧提交、个人部署和第三方修改版本不单独维护。

## Reporting a Vulnerability

请不要通过公开 Issue、Discussion、Pull Request 或日志附件披露未修复漏洞、利用步骤、凭据或生产数据。

公开仓库启用 GitHub Private Vulnerability Reporting 后，请在仓库的 **Security → Advisories → Report a vulnerability** 中提交报告，并包括：

- 受影响路径和版本；
- 最小复现步骤；
- 可能影响及已知利用条件；
- 建议修复或缓解措施（如有）。

维护者确认问题前不会要求提供真实 Token、密码或生产数据。若 GitHub 私密报告入口尚未启用，应等待维护者公布私密联系方式，不要改用公开渠道披露。

## Deployment Responsibility

T-IMG 不托管使用者的 Telegram、Cloudflare 或内容审核凭据。部署者负责保护环境变量、KV 数据、管理入口和 Cloudflare 账户，并在上线前完成隔离环境验证。
