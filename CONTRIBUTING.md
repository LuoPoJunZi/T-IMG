# Contributing to T-IMG

感谢参与 T-IMG。提交变更前请先阅读 `AGENTS.md`、`docs/REPOSITORY_CONVENTIONS.md` 和相关需求记录。

## 开发流程

1. 从最新 `main` 创建范围清晰的分支。
2. 只修改当前问题所需文件，不提交凭据、环境文件、Wrangler 本地数据或 `node_modules/`。
3. 页面、普通源码和资源名称遵循 kebab-case；Cloudflare Pages 保留名称和兼容路由按仓库规范处理。
4. Bug 修复应增加回归测试；行为、配置或公开路径变化需同步维护文档。
5. 提交前运行：

```bash
npm ci
npm audit --audit-level=high
npm test
npm run ci-test
git diff --check
```

## Pull Request

- 标题简明说明结果，正文描述背景、实现、兼容影响和验证结果。
- 一个 Pull Request 只处理一个主题，避免夹带无关格式化或依赖升级。
- 不在 Issue、日志、截图或测试夹具中粘贴 Token、密码、Cookie、Authorization Header 或生产数据。
- 涉及安全漏洞时不要创建公开 Issue，请按照 `SECURITY.md` 私下报告。

English contributions are welcome. Please keep code identifiers and filenames in clear English, document behavior changes, and include reproducible verification steps.
