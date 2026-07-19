# 二次开发计划

## 当前基线

- 当前发布基线提交：`0018d65e722e2508a7442cac10b27530359469b0`
- 基线提交日期：2026-02-27（提交时区 UTC-08:00）
- 当前分支：`main`
- Git 远程：仅配置个人公开仓库 `https://github.com/LuoPoJunZi/T-IMG.git` 为 `origin`，不配置其他代码远程
- 初始本地工具：Node.js `v20.15.0`、npm `10.7.0`；公开发布基线升级为 Node.js 22
- 依赖基线：首次测试因缺少测试运行器无法启动；公开发布时改用 Node 内置测试并完成 0 漏洞审计
- 原始测试：`npm test` 为 0 通过、2 失败；`npm run ci-test` 可启动 Wrangler，但同样因 Node 未按 ESM 加载 Functions 而失败
- 已知问题：测试模块类型不一致、`node_modules` 被跟踪、同步工作流每日同步 `main`、未固定 Wrangler 兼容日期、业务测试覆盖不足及若干安全/接口风险

## 第一阶段：项目规范与基线

目标是完成真实仓库检查、依赖和测试基线、长期规则及项目文档。本阶段允许修改文档、测试基础设施、忽略规则和外部同步安全配置，不修改业务逻辑。

预计文件：`AGENTS.md`、`docs/*.md`、`.env.example`、`.gitignore`、`CHANGELOG.md`、`package.json`、`test/pagination.test.js`、`.github/workflows/*.yml`。

验收：文档互相一致；原始问题有记录；现有测试可运行；不存在外部代码自动同步；无敏感信息。

## 第二阶段：核心功能开发

状态：已暂停，等待项目所有者提供并确认正式业务需求。收到需求后，先在 `docs/REQUIREMENTS.md` 分配唯一编号，再分析当前行为、目标行为、接口与数据影响、风险和测试。

## 第三阶段：界面优化

状态：已暂停。不得根据总任务说明中的示例擅自修改首页或后台页面。

## 第四阶段：测试与兼容性检查

每项后续需求完成后运行相关单元测试；涉及 Pages Functions 时运行本地 Wrangler 链路；阶段结束运行 `npm test`、`npm run ci-test`、`git diff --check`，并记录无法连接真实 Telegram/Cloudflare 的限制。

## 第五阶段：部署文档与发布准备

部署文档已建立。实际部署、远程配置、提交、推送和 Release 仅在项目所有者明确授权后执行。

## 任务清单

| 编号 | 任务 | 状态 | 涉及文件 | 验收方式 |
|---|---|---|---|---|
| DEV-001-A | 检查 Git、目录、配置与主要调用链 | 已完成 | 只读检查 | 基线信息可追溯 |
| DEV-001-B | 安装依赖并记录原始测试基线 | 已完成 | 本地依赖目录 | 记录实际命令与失败原因 |
| DEV-001-C | 建立协作、架构、需求、计划和工作文档 | 已完成 | `AGENTS.md`、`docs/*.md` | 内容基于实际代码且无空文档 |
| DEV-001-D | 建立安全环境变量示例和忽略规则 | 已完成 | `.env.example`、`.gitignore` | 本地敏感文件被忽略，模板被保留 |
| DEV-001-E | 对齐 ES Module 测试配置 | 已完成 | `package.json`、`test/pagination.test.js` | `npm test` 通过 2 项测试 |
| DEV-001-F | 消除外部代码同步覆盖风险 | 已完成 | `.github/workflows/` | 删除同步工作流，不配置外部代码远程 |
| DEV-001-G | 完整回归、差异和敏感信息复核 | 已完成 | 全部标准化文件 | 测试、静态检查和 Git 报告完成 |
| DEV-002 | 项目更名为 T-IMG | 已完成 | README、静态页面、包信息、文档 | 品牌扫描和页面检查 |
| DEV-003 | 依赖与运行基线治理 | 已完成 | `node_modules/`、`package*.json`、本地启动配置 | 安装、Git、Wrangler 验证 |
| DEV-004 | 上传链路安全与稳定性修复 | 已完成 | `functions/upload.js`、测试 | Mock Telegram/KV 回归测试 |
| DEV-005 | 管理接口正确性与信息泄露修复 | 已完成 | `functions/api/manage/`、测试 | 认证与管理接口测试 |
| DEV-006 | 文件代理与遥测隐私修复 | 已完成 | `functions/file/`、`functions/utils/`、依赖、测试 | 代理与异常测试 |
| DEV-007 | 仓库文件与命名标准化 | 已完成 | 根目录页面、`assets/`、管理路由、README、维护文档 | 引用扫描、兼容路径、完整回归 |
| DEV-008 | 独立公开仓库发布准备 | 已完成 | `main`、GitHub Actions、Node 22、公开协作文档、README | 31 项测试、Wrangler 4、npm audit、远程检查 |
| DEV-009 | 上传页面后端访问保护 | 已完成 | 根级中间件、上传认证 API、登录页、`/upload`、配置和文档 | 50 项测试、Wrangler 4、真实 HTTP 会话流程 |
| DEV-010+ | 其他正式业务功能 | 已暂停 | 待分析 | 等待项目所有者确认 |

## 依赖关系

`DEV-001-A` 是文档和计划的依据；`DEV-001-B` 提供测试基线；`DEV-001-C` 与 `DEV-001-D` 完成后才能进行一致性和敏感信息检查；`DEV-001-E`、`DEV-001-F` 验证完成后执行 `DEV-001-G`。业务开发必须在 DEV-001 完成且正式需求确认后开始。

## 风险与控制

- 已跟踪依赖会制造巨大安装差异：已从 Git 索引取消跟踪并由 `.gitignore` 排除，本地依赖目录仍保留；大规模删除差异需在提交前重点审查。
- `type: module` 会影响 Node 对 `.js` 的解析：现有 Functions 本身已使用 ESM，验证 `npm test` 和 Wrangler 编译以控制风险。
- 不采用外部代码同步：项目依靠独立维护、依赖审计和完整测试控制变更风险。
- 缺少真实 Telegram、KV 和审核凭据：不使用生产密钥，本次只验证无外部写入的本地链路。
- 上传认证依赖 Pages Functions：生产项目必须保留 `_routes.json` 并将配额行为设为 Fail closed，防止 Function 不可用时静态页面失败开放。
- `UPLOAD_AUTH_KV` 是最终一致的基础限流：高风险公开部署应叠加 Cloudflare WAF/Rate Limiting 或 Access。

## 当前状态

DEV-001 至 DEV-009 均已完成；其他示例业务功能保持暂停。当前分支为 `main`，仅跟踪个人公开 `origin`；DEV-008 发布基线已推送，DEV-009 尚未提交、推送或部署生产。
