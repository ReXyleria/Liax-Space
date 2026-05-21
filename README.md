# Liax-Space

## 项目介绍

Liax-Space 是一个面向个人站点、独立博客和小型内容社区的发布系统。它把公开阅读、后台管理、账号登录、邮件通知、附件管理、访问统计、备份恢复、双语言内容和站点外观配置放在同一个可部署应用里，适合长期运行在自己的服务器上。

系统采用 Next.js App Router、Prisma、MySQL 和 Docker 部署。文章、用户、设置、评论、访问记录等结构化数据存入 MySQL；上传文件、备份和运行时配置通过宿主机目录持久化，方便迁移、升级和恢复。

## 同类项目对比优势

- **双语言内容更自然**：文章可以选择中文或 English 作为原文，另一种语言作为翻译展示；中文读者和英文母语作者都不需要围绕单一中文原文工作。
- **发布体验更省心**：后台集中管理文章、附件、评论、访问统计、邮件、备份和搜索引擎推送，常用操作不需要在多个工具之间切换。
- **读者感受更完整**：公开页面支持双语言展示、响应式布局、文章可见性、评论、瞬间、归档、标签和可配置首页背景，更像一个可以长期运营的站点，而不是临时演示。
- **备份恢复更安心**：MySQL 数据、上传附件、备份文件和运行时配置都有明确的持久化目录；恢复备份后附件目录会被保留或重新创建，避免 `/uploads/...` 因目录丢失而无法显示。
- **安全默认值更强**：登录支持二次验证、邮箱验证码、TOTP 和恢复码；生产镜像使用更小的 Chainguard Node runtime，应用以非 root UID/GID `1001:1001` 运行，final image 不依赖 apt、gosu 或 root 启动脚本。
- **更适合自托管维护**：推荐 Docker Compose 部署，宿主机只需要准备数据目录和环境变量；app 与 worker 共用同一套 storage/uploads/backups 路径，迁移和排查边界清楚。

## 安装教程

### 1. 准备目录

生产容器以 UID/GID `1001:1001` 运行。宿主机挂载给容器的 `storage` 和 `uploads` 目录必须允许这个用户写入。

```bash
mkdir -p /opt/liax-space/data/storage/config
mkdir -p /opt/liax-space/data/storage/backups
mkdir -p /opt/liax-space/data/storage/cache
mkdir -p /opt/liax-space/data/uploads
mkdir -p /opt/liax-space/data/mysql
chown -R 1001:1001 /opt/liax-space/data/storage /opt/liax-space/data/uploads
cd /opt/liax-space
```

### 2. 创建 `.env`

`.env` 必须和 `compose.yaml` 分开保存，不能把 Compose 内容写进 `.env`。

```dotenv
APP_PATH=/opt/liax-space
MYSQL_PASSWORD=change_this_database_password
MYSQL_ROOT_PASSWORD=change_this_root_password
```

### 可选：构建私有 Node 22 镜像

Dockerfile 默认使用 Chainguard 公开可拉取的 `cgr.dev/chainguard/node:latest-dev` 和 `cgr.dev/chainguard/node:latest`，避免版本化 tag 不存在导致构建失败。如果你的 Chainguard 组织仓库开通了 Node 22 版本化镜像，可以在构建时覆盖：

```bash
docker buildx build \
  --build-arg CHAINGUARD_NODE_DEV_IMAGE=cgr.dev/YOUR_ORG/node:22-dev \
  --build-arg CHAINGUARD_NODE_RUNTIME_IMAGE=cgr.dev/YOUR_ORG/node:22-slim \
  -t liax-space:chainguard-node22 .
```

### 3. 创建 `compose.yaml`

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: liax-space-mysql
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: liax_space
      MYSQL_USER: liax_space
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - ${APP_PATH:?APP_PATH is required}/data/mysql:/var/lib/mysql

  app:
    image: rexyleria/liax-space:latest
    container_name: liax-space-app
    restart: unless-stopped
    depends_on:
      - mysql
    ports:
      - "3000:3000"
    environment:
      APP_STORAGE_DIR: /app/storage
      SETUP_CONFIG_DIR: /app/storage/config
      UPLOAD_DIR: /app/public/uploads
      BACKGROUND_WORKER_MODE: external
      MYSQL_HOST: mysql
      MYSQL_PORT: "3306"
      MYSQL_DATABASE: liax_space
      MYSQL_USER: liax_space
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - ${APP_PATH:?APP_PATH is required}/data/storage:/app/storage
      - ${APP_PATH:?APP_PATH is required}/data/uploads:/app/public/uploads

  worker:
    image: rexyleria/liax-space:latest
    container_name: liax-space-worker
    restart: unless-stopped
    depends_on:
      - mysql
      - app
    command: ["scripts/docker-entrypoint.mjs", "worker"]
    environment:
      APP_STORAGE_DIR: /app/storage
      SETUP_CONFIG_DIR: /app/storage/config
      UPLOAD_DIR: /app/public/uploads
      BACKGROUND_WORKER_MODE: external
      BACKGROUND_WORKER_ROLE: worker
      MYSQL_HOST: mysql
      MYSQL_PORT: "3306"
      MYSQL_DATABASE: liax_space
      MYSQL_USER: liax_space
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - ${APP_PATH:?APP_PATH is required}/data/storage:/app/storage
      - ${APP_PATH:?APP_PATH is required}/data/uploads:/app/public/uploads
```

重点检查：

- `app.environment` 和 `worker.environment` 都必须包含 `MYSQL_PASSWORD: ${MYSQL_PASSWORD}`。
- 上传目录使用 `${APP_PATH}/data/uploads:/app/public/uploads`。
- 存储目录使用 `${APP_PATH}/data/storage:/app/storage`。
- MySQL 数据目录使用 `${APP_PATH}/data/mysql:/var/lib/mysql`。
- 如果日志提示目录不可写，先确认宿主机 `data/storage` 和 `data/uploads` 已授权给 UID/GID `1001:1001`。

### 4. 启动服务

```bash
docker compose up -d
docker compose logs -f app
```

如果日志显示迁移成功，访问：

```text
http://服务器地址:3000/setup
```

按照页面填写安装令牌、站点域名、数据库连接和管理员账号。使用上面的 Compose 配置时，数据库主机填写 `mysql`，端口填写 `3306`，数据库名和用户名填写 `liax_space`，密码填写 `.env` 中的 `MYSQL_PASSWORD`。

### 5. 迁移和重建提醒

如果你是全新安装，建议使用空的 MySQL 数据目录启动。应用镜像会在启动时执行 Prisma 迁移并创建基础表。

如果服务器已有旧的 `/opt/liax-space/data/mysql`，并且其中存在失败的 `_prisma_migrations` 记录，不能直接覆盖迁移历史。确认没有需要保留的生产数据后，再清空旧 MySQL 数据目录或换一个空数据库重新部署。

### 6. 常用排查命令

```bash
docker compose ps
docker compose logs -f mysql
docker compose logs -f app
docker compose logs -f worker
```

数据库可用但提示缺表时，重点查看 app 日志中 `Prisma migrations applied` 或 `prisma migrate deploy` 相关输出。上传文件存在但浏览器访问失败时，确认 `${APP_PATH}/data/uploads` 已正确挂载到 `/app/public/uploads`，并且宿主机目录可被 UID/GID `1001:1001` 写入。
