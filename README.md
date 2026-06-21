# Liax-Space

## 项目介绍

Liax-Space 是一个面向个人站点、独立博客和小型内容社区的双语言发布系统。它把公开阅读、内容管理、账号安全、附件管理、SEO、搜索、访问统计、备份恢复和静态 HTML 发布放在同一个可部署应用里，适合长期运行在自己的服务器上。

系统以 Markdown 和附件作为源数据，支持 `zh-CN` / `en-US` 两套内容、`/zh` / `/en` 公开路由、按语言独立的标题、slug、SEO、摘要和正文。文章发布后会生成可重建的静态 HTML；上传文件通过 `attachment://id` 引用，便于迁移和恢复。

当前版本采用 Node.js、Express、MySQL、React 和 Vite。后台控制台由 React 构建后随 server 镜像一起提供，入口为 `/console`；公开页面、API、附件、渲染产物和运维任务由同一个 server 应用管理。

## 同类项目对比优势

- **双语言内容边界清楚**：中文和英文不是简单机翻字段，而是各自拥有标题、slug、SEO、摘要、正文和发布状态；公开页面不会在缺失内容时随意 fallback 到另一种语言。
- **Markdown 长文更稳**：Markdown 是源数据，HTML 是派生产物；长文读取支持分块传输，可视化预览按块加载，避免大文档一次性塞满编辑器。
- **权限展示更直观**：文章可以显示公开、SVIP 及以上、SSVIP 等可见范围，后台和公开页都能让读者或管理员知道内容面向谁。
- **附件引用可迁移**：图片和文件通过附件库统一管理，正文使用 `attachment://id` 引用，发布和预览时再解析成公开地址，减少硬编码 URL 带来的迁移成本。
- **后台操作集中**：文章、版本、发布、标签、分类、瞬间、留言、用户、角色、站点设置、邮件、备份和一致性检查都在 `/console` 工作台完成。
- **公开站点更完整**：支持文章列表、标签、归档、瞬间、留言、RSS、sitemap、搜索、阅读数、语言切换和响应式布局。
- **自托管维护边界清楚**：MySQL 保存结构化数据，`storage/uploads` 保存源附件，`storage/rendered` 保存可重建 HTML，`storage/backups` 保存备份，恢复后可以重新构建公开 HTML。

## 安装教程

### 1. 准备环境

推荐使用 Docker Compose 部署。服务器需要能拉取镜像并对外开放应用端口，例如 `3000`。

```bash
mkdir -p /opt/liax-space
cd /opt/liax-space
```

### 2. 创建 `.env`

`.env` 只保存部署参数和数据库密码，不要提交到 Git。

```dotenv
APP_PORT=3000
PUBLIC_BASE_URL=https://example.com
DATABASE_NAME=liax_space
DATABASE_USER=root
DATABASE_PASSWORD=change_this_database_password
APP_IMAGE=rexyleria/liax-space:latest
```

如果你使用自己的镜像标签，把 `APP_IMAGE` 改成对应镜像即可。

### 3. 创建 `docker-compose.yml`

```yaml
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: ${DATABASE_NAME:-liax_space}
      MYSQL_ROOT_PASSWORD: ${DATABASE_PASSWORD:-root}
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p$${MYSQL_ROOT_PASSWORD} --silent"]
      interval: 10s
      timeout: 5s
      retries: 10

  app:
    image: ${APP_IMAGE:-rexyleria/liax-space:latest}
    pull_policy: always
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      APP_ENV: production
      APP_HOST: 0.0.0.0
      APP_PORT: 3000
      DATABASE_HOST: mysql
      DATABASE_PORT: 3306
      DATABASE_NAME: ${DATABASE_NAME:-liax_space}
      DATABASE_USER: ${DATABASE_USER:-root}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD:-root}
      STORAGE_UPLOADS_DIR: /app/storage/uploads
      STORAGE_RENDERED_DIR: /app/storage/rendered
      STORAGE_RUNTIME_DIR: /app/storage/runtime
      PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:-http://localhost:3000}
    ports:
      - "${APP_PORT:-3000}:3000"
    volumes:
      - uploads:/app/storage/uploads
      - rendered:/app/storage/rendered
      - runtime:/app/storage/runtime
      - backups:/app/storage/backups

volumes:
  mysql-data:
  uploads:
  rendered:
  runtime:
  backups:
```

### 4. 启动服务

```bash
docker compose pull
docker compose up -d
docker compose logs -f app
```

容器首次启动会自动运行数据库迁移；如果还没有管理员账号，会在运行时目录创建 setup token。

服务启动后访问：

```text
http://服务器地址:3000
http://服务器地址:3000/console
```

首次初始化管理员前，查看自动创建的 setup token：

```bash
docker compose exec app cat /app/storage/runtime/setup-token
```

然后打开 `/console`，按照初始化流程创建管理员账号。

### 5. 常用维护命令

```bash
docker compose exec app node apps/server/dist/database/migrate.js latest
docker compose exec app node apps/server/dist/jobs/runBackup.js
docker compose exec app node apps/server/dist/jobs/runRestore.js --backup-dir=storage/backups/{timestamp} --confirm-restore
docker compose exec app node apps/server/dist/jobs/runRebuildHtml.js
docker compose exec app node apps/server/dist/jobs/runCheckConsistency.js
docker compose exec app node apps/server/dist/jobs/runCleanupRenderedHtml.js
docker compose exec app node apps/server/dist/jobs/runCleanupUnusedAttachments.js
```

`storage/uploads` 是源附件，需要备份；`storage/rendered` 是可重建的 HTML 产物，恢复备份后可以通过 `runRebuildHtml.js` 重新生成。

### 6. 常用排查命令

```bash
docker compose ps
docker compose logs -f mysql
docker compose logs -f app
docker compose exec app node apps/server/dist/database/migrate.js latest
```

数据库可用但页面提示缺表时，先运行迁移命令。文章页面缺少图片时，检查 `uploads` 卷是否仍然存在。公开页面没有更新时，重新运行 HTML 重建任务。

## 联系方式

- QQ：1091149319
- 邮箱：Miyu@toliax.com
