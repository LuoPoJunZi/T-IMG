# 仓库与文件命名规范

## 适用范围

本规范适用于 T-IMG 后续新增或重命名的源码、静态页面、资源、测试和维护文档。公开 URL、Cloudflare Pages Functions 约定和既有生成产物存在兼容要求时，以兼容性优先，并在本文件记录例外。

## 命名规则

- 静态页面、样式、图片、图标及普通目录统一使用小写 kebab-case，例如 `admin-gallery.html`、`image-blocked.html`、`admin-gallery.css`。
- JavaScript 源码和测试文件使用小写 kebab-case；测试统一使用 `*.test.js`。
- JavaScript 标识符使用 camelCase，类名使用 PascalCase，常量仅在确为全局常量时使用 UPPER_SNAKE_CASE。
- 区域化文档使用 BCP 47 风格后缀，例如 `README.zh-CN.md`。
- 社区和工具约定文件保留其标准名称，例如 `README.md`、`LICENSE`、`CHANGELOG.md`、`AGENTS.md`、`.gitignore` 和 `_redirects`。
- 资源按用途放入 `assets/images/`、`assets/icons/`、`assets/styles/`、`assets/scripts/`；站点根目录只保留入口页面和必须位于根目录的约定文件。
- 文档集中在 `docs/`，文件名使用大写单词和下划线，以与现有维护文档保持一致。

## Cloudflare 与构建约定

- Pages Functions 的 `_middleware.js`、动态参数 `[id].js` 和目录入口 `index.js` 必须保留框架名称。
- `functions/` 下的目录直接决定公开 API 路径。新路由使用 kebab-case；已经发布的旧路由不得无兼容层直接删除。
- 根目录 `_routes.json` 控制哪些请求必须进入 Functions；涉及认证页面时不得删除或放宽对应规则。由 Function 生成或包装的响应头必须在后端代码中设置，不能依赖静态 `_headers` 规则。
- `_nuxt/` 是既有生成产物，哈希文件名和字体文件名不得手工改名；修改入口引用时必须同步检查对应构建产物。
- `_redirects` 保存旧静态 URL 到规范名称的永久重定向。删除兼容项前必须确认生产访问日志和外部调用方均不再使用旧路径。

## 当前兼容例外

- `/api/manage/editName/:id` 兼容转发到规范实现 `/api/manage/edit-name/:id`。
- `/api/manage/toggleLike/:id` 兼容转发到规范实现 `/api/manage/toggle-like/:id`。
- `index-md.html`、`admin-imgtc.html`、`block-img.html`、`whitelist-on.html` 及旧资源路径由 `_redirects` 转向规范路径。

## 新增文件检查清单

1. 名称是否清晰表达用途，且没有项目内部缩写。
2. 是否符合本目录的大小写和分隔符规则。
3. 是否会形成新的公开 URL；若会，是否记录兼容影响。
4. 页面、源码、测试、README 和维护文档中的引用是否全部同步。
5. 是否通过 `npm test`、`npm run ci-test`、引用扫描和 `git diff --check`。
