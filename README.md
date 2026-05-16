# Liax-Space

## 项目介绍

Liax-Space 是一个面向个人站点、独立博客和小型内容社区的发布系统。它把公开阅读、后台管理、账号登录、邮件通知、附件管理、访问统计、备份恢复和站点外观配置放在同一个可部署应用里，适合长期运行在自己的服务器上。

系统采用 Next.js App Router、Prisma、MySQL 和 Docker 部署。文章、用户、设置、评论、访问记录等结构化数据存入 MySQL；上传文件、备份和运行时配置通过宿主机目录持久化，方便迁移、升级和恢复。

## 同类项目对比优势

- **安装路径更短**：推荐直接使用 Docker Compose，不需要在服务器上安装 Node.js 或手动构建源码。
- **首装流程更清楚**：首次访问 `/setup` 完成数据库、站点域名和管理员账号初始化，缺表、迁移失败、数据库不可用等状态会给出明确提示。
- **后台体验更完整**：内容、附件、访问统计、站点设置、邮件、备份和搜索引擎推送集中在后台，常用管理动作不需要切换多个工具。
- **数据更容易迁移**：MySQL 数据、上传文件、备份文件和运行时配置都有明确持久化目录，重建容器不会丢失业务数据。
- **面向读者体验**：公开页面支持响应式布局、访问统计、文章可见性、评论、瞬间、归档、标签和可配置首页背景，适合实际发布而不是临时演示。
- **更适合自托管维护**：启动脚本会修复上传和存储目录权限，容器内应用降权运行；部署配置避免依赖 `./storage` 这类容易混淆的相对路径。

## 安装教程

### 1. 准备目录

```bash
mkdir -p /opt/liax-space/data/storage/config
mkdir -p /opt/liax-space/data/storage/backups
mkdir -p /opt/liax-space/data/storage/cache
mkdir -p /opt/liax-space/data/uploads
mkdir -p /opt/liax-space/data/mysql
cd /opt/liax-space
```

### 2. 创建 `.env`

`.env` 必须和 `compose.yaml` 分开保存，不能把 Compose 内容写进 `.env`。

```dotenv
APP_PATH=/opt/liax-space
MYSQL_PASSWORD=change_this_database_password
MYSQL_ROOT_PASSWORD=change_this_root_password
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
      MYSQL_HOST: mysql
      MYSQL_PORT: "3306"
      MYSQL_DATABASE: liax_space
      MYSQL_USER: liax_space
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - ${APP_PATH:?APP_PATH is required}/data/uploads:/app/public/uploads
      - ${APP_PATH:?APP_PATH is required}/data/storage:/app/storage
```

重点检查：

- `app.environment` 必须包含 `MYSQL_PASSWORD: ${MYSQL_PASSWORD}`。
- 上传目录使用 `${APP_PATH}/data/uploads:/app/public/uploads`。
- 存储目录使用 `${APP_PATH}/data/storage:/app/storage`。
- MySQL 数据目录使用 `${APP_PATH}/data/mysql:/var/lib/mysql`。

### 4. 启动服务

```bash
docker compose up -d
docker compose logs -f app
```

如果日志显示迁移成功，访问：

```text
http://服务器地址:3006/setup
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
```

数据库可用但提示缺表时，重点查看 app 日志中 `Prisma migrations applied` 或 `prisma migrate deploy` 相关输出。上传文件存在但浏览器访问失败时，确认 `${APP_PATH}/data/uploads` 已正确挂载到 `/app/public/uploads`。
