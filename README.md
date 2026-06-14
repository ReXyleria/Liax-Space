# Liax Space

## 项目目标

Liax Space 是一个支持 `zh-CN` / `en-US` 的双语言内容系统，用 Markdown 和附件作为源数据，将公开文章发布为可重建的静态 HTML。

## 核心功能

- 中英文后台界面和中英文公开页面。
- 管理员初始化、密码登录、TOTP、Passkey、角色权限。
- Markdown 文章编辑、双语言标题、slug、SEO、summary 和 Markdown 内容。
- 保存草稿、预览、发布为静态 HTML、回滚版本。
- 附件上传和 `attachment://id` 引用。
- 标签、分类、SEO、RSS、sitemap、搜索。
- 审计日志、一致性检查、清理、备份恢复和 HTML 重建。
- 语言切换圆形扩散动画，动画期间保留旧语言层和新语言 overlay。

## 技术栈

- TypeScript
- Node.js + Express
- MySQL
- React + Vite
- Playwright
- Markdown 渲染器
- 本地文件存储

## 本地启动

先准备 `.env`，可以参考 `.env.example`。真实 `.env` 不提交 Git，默认只需要数据库账号和密码：

```text
DATABASE_USER=root
DATABASE_PASSWORD=root
```

JWT secret 和 password pepper 会自动生成到 `storage/runtime`。根目录提供统一脚本，首次拉取后先安装前后端依赖：

```text
npm run install:all
npm run check:env
npm run migrate:latest
npm run dev:server
npm run dev:admin
```

首次运行需要生成 setup token，然后通过初始化管理员流程创建 admin。构建完成后可以用正式命令生成 token 文件：

```text
npm run create-setup-token
```

## 文档索引

- [项目愿景](docs/00-project-vision.md)
- [产品范围](docs/01-product-scope.md)
- [用户流程](docs/02-user-journeys.md)
- [设计系统](docs/03-design-system.md)
- [国际化策略](docs/04-i18n-strategy.md)
- [内容模型](docs/05-content-model.md)
- [数据生命周期](docs/06-data-lifecycle.md)
- [安全模型](docs/07-security-model.md)
- [架构概览](docs/08-architecture-overview.md)
- [文件地图](docs/09-file-map.md)
- [API 契约](docs/10-api-contract.md)
- [数据库设计](docs/11-database-design.md)
- [测试策略](docs/12-test-strategy.md)
- [Debug 策略](docs/13-debug-strategy.md)
- [部署策略](docs/14-deployment-strategy.md)
- [Docker Compose 新手部署页](docs/docker-compose-deployment-guide.md)
- [最终验收清单](docs/final-acceptance-checklist.md)
- [术语表](docs/99-glossary.md)
- [ADR：Markdown 是源数据](decisions/ADR-0001-markdown-is-source.md)
- [ADR：HTML 是派生产物](decisions/ADR-0002-html-is-derived-artifact.md)
- [ADR：公开 URL 语言前缀](decisions/ADR-0003-locale-url-prefix.md)
- [ADR：暖色极简设计系统](decisions/ADR-0004-warm-minimal-design-system.md)
- [ADR：语言切换 overlay](decisions/ADR-0005-language-wipe-overlay.md)

## 开发顺序

1. 先维护文档、ADR 和验收清单。
2. 再维护 shared 类型、设计 token 和基础 UI。
3. 然后实现 server 基础设施、数据库、认证和权限。
4. 继续实现内容模型、渲染、发布、公开访问和附件。
5. 最后完善后台 UI、公开页面、测试、Debug、部署和备份恢复。

每一步只完成当前目标，不提前实现后续功能。

## 视觉规范摘要

- 页面背景必须使用 `#faf9f5`。
- 不使用纯白页面背景。
- 不使用照片背景。
- 不实现纸张图片背景。
- 不实现鼠标纸张褶皱高亮。
- 正文文字使用 `#141413`。
- 主按钮使用暖黑底和米白字。
- 品牌按钮使用陶土橙和米白字。
- `#d97757` 只少量用于链接、强调、hover、focus 和 underline。

## 双语言规则摘要

- 支持 `zh-CN` 和 `en-US`。
- 公开 URL 使用 `/zh` 和 `/en` 前缀。
- 文章标题、slug、SEO、summary、Markdown 内容都是语言相关数据。
- Markdown 是文章源数据。
- 附件是源数据。
- HTML 是可重建派生产物。
- 公开文章不要自动 fallback 到另一种语言。

## Debug 入口

```text
npm run check:env
npm run check:consistency
npm run check:design
npm run rebuild-html -- --dry-run
```

语言切换动画可在后台使用 `?uiDebug=1` 检查，debug mode 才允许暴露 `window.__uiDebug.setLanguageWipeProgress(progress)`。

## 测试命令

```text
npm run test
npm run test:visual
npm run check:acceptance
npm run check:design
npm run check:docker-context
```

## 部署入口

新手优先按 [Docker Compose 新手部署页](docs/docker-compose-deployment-guide.md) 操作。它从 Docker 安装检查、`.env` 填写、容器启动、migration、初始化管理员、打开 `/console` 工作台到备份恢复逐步说明。

部署前先运行：

```text
npm run check:env
npm run migrate:latest
npm run build
```

生产镜像会把后台构建产物打进 server 镜像，后台入口为 `/console`，API 仍为 `/admin/*`，公开站点仍使用 `/zh` 和 `/en`。

Docker / Tencent 测试部署检查：

```text
npm run check:docker-context
npm run check:acceptance
npm run check:install
docker compose config
docker compose pull
docker compose up -d
```

当前 `docker-compose.yml` 的 app 服务默认使用 Docker Hub 测试镜像 `rexyleria/liax-space:test`，也可以通过 `APP_IMAGE=rexyleria/liax-space:test-<short-sha>` 固定到不可变测试镜像；不是 `:main`，也不是在服务器上重新 build。`pull_policy: always` 会在启动前拉取配置的镜像。本地 compose 的 `.env` 只放数据库账号密码和可选 `APP_IMAGE`；`.env.example` 只是本地占位示例，不进入 Git 或 Docker context。

`npm run check:docker-context` 会检查 Dockerfile、compose、两个发布 workflow、`.dockerignore`、部署文档和生产 dist 边界。运行镜像不应携带 `.env`、`.env.example`、测试文件、文档、旧日志、截图或开发脚本。

`npm run check:acceptance` 会检查当前仓库是否保留了关键用户流程、视觉动画、后台设置、公开首页、Docker 发布和新手部署路径的直接验收证据。

`npm run check:install` 生成安装链路报告。默认只做静态结构检查；部署机上可以运行 `npm run check:install -- --strict-docker`，要求 `docker compose config` 必须通过。

Compose 容器启动后使用镜像内已编译入口运行运维命令：

```text
docker compose exec app node apps/server/dist/database/migrate.js latest
docker compose exec app node apps/server/dist/setup/createSetupToken.js
docker compose exec app node apps/server/dist/jobs/runBackup.js
docker compose exec app node apps/server/dist/jobs/runRebuildHtml.js
docker compose exec app node apps/server/dist/jobs/runCheckConsistency.js
docker compose exec app node apps/server/dist/jobs/runCleanupRenderedHtml.js
docker compose exec app node apps/server/dist/jobs/runCleanupUnusedAttachments.js
```

`/console` 是每个登录用户的 Liax Space 工作台。管理员拥有更多权限，所以会看到更多菜单；普通用户仍有自己的工作台和个人设置入口。

镜像发布：

- `.github/workflows/docker-publish.yml` 发布到 `ghcr.io/rexyleria/liax-space`。
- `.github/workflows/dockerhub.yml` 发布到 `rexyleria/liax-space`。
- GHCR 使用 `GITHUB_TOKEN`；Docker Hub 需要 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN`。

备份和恢复入口：

```text
npm run backup
npm run restore -- --backup-dir=storage/backups/{timestamp} --confirm-restore
npm run rebuild-html
```

`storage/uploads` 是源数据，需要备份。`storage/rendered` 是可重建 HTML 产物，恢复后需要运行 `rebuild-html`。
