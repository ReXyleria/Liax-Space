# Liax-Space

Liax-Space 是一个面向个人博客、独立站点和小型内容社区的内容发布系统。它提供公开博客页面、后台内容管理、文章编辑能力，适合部署在自有服务器上长期运行。

系统支持 Docker 镜像部署。部署者从 GitHub Container Registry 拉取镜像并启动容器，首次访问 `/setup` 页面后填写数据库连接、站点域名和管理员账号，即可完成初始化。

## 项目概述

Liax-Space 的设计目标是让个人站点具备完整的内容管理能力，同时保持部署流程清晰、数据可迁移、运行结构稳定。

主要能力包括：

- 公开页面：主页、文章、标签、归档、瞬间、联系页。
- 内容管理：文章发布、标签管理、瞬间管理、评论管理、附件管理。
- 权限控制：用户身份、文章可见范围、后台操作权限。
- 安全能力：登录、设备管理、TOTP、Passkey。
- 站点配置：站点标题、域名、背景、主题色、联系方式、页脚。
- 数据管理：完整备份、上传还原、数据库主数据源、附件持久化。
- 访问体验：缓存预热、响应式布局、页面过渡动画。

运行时数据以数据库为主数据源。上传文件、备份文件和运行时配置保存在挂载目录中，便于迁移和恢复。

## 相比同类项目的优势

- **部署更直接**：通过 GitHub Container Registry 拉取镜像，不要求服务器安装 Node.js，也不要求在服务器上构建源码。
- **初始化更清晰**：站点域名、数据库连接和管理员账号都在 `/setup` 页面填写，不需要把业务初始化信息写进环境文件。
- **数据更完整**：文章、用户、设置、译文和媒体元数据存入数据库，附件和备份通过挂载目录持久化。
- **后台功能更集中**：内置文章、标签、瞬间、用户、身份、附件、备份和设置管理。
- **权限边界更明确**：文章访问和后台操作都由服务端校验，不依赖前端隐藏按钮作为安全边界。
- **更适合长期运行**：支持生产迁移、缓存预热、完整备份和 Docker Compose 升级。

## Docker 部署

单容器部署适合已经有 MySQL 数据库的场景。

拉取镜像：

```bash
docker pull rexyleria/liax-space:latest
```

创建持久化目录：

```bash
APP_PATH=/opt/liax-space
mkdir -p "$APP_PATH/data/storage" "$APP_PATH/data/uploads"
```

启动容器：

```bash
docker run -d \
  --name liax-space \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "$APP_PATH/data/uploads:/app/public/uploads" \
  -v "$APP_PATH/data/storage:/app/storage" \
  rexyleria/liax-space:latest
```

查看安装令牌：

```bash
docker logs liax-space
```

启动后访问：

```text
http://服务器地址:3000/setup
```

在安装页面填写已有 MySQL 数据库连接、站点域名和管理员账号。提交后，系统会写入运行时配置并自动重启。

## Docker Compose 部署

Docker Compose 部署适合同时运行应用和 MySQL 数据库，是推荐方式。

创建部署目录：

```bash
mkdir -p /opt/liax-space/data/storage /opt/liax-space/data/uploads /opt/liax-space/data/mysql
cd /opt/liax-space
```

写入 `.env`：

```bash
APP_PATH=/opt/liax-space
MYSQL_PASSWORD=change_this_database_password
MYSQL_ROOT_PASSWORD=change_this_root_password
```

写入 `compose.yaml`：

```bash
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
    volumes:
      - ${APP_PATH:?APP_PATH is required}/data/uploads:/app/public/uploads
      - ${APP_PATH:?APP_PATH is required}/data/storage:/app/storage
```

启动服务：

```bash
docker compose up -d
```

查看安装令牌：

```bash
docker compose logs app
```

启动后访问：

```text
http://服务器地址:3000/setup
```

## 首次安装

首次安装通过 `/setup` 页面完成。站点域名和管理员账号不需要提前写入容器配置。

安装页面需要填写：

- 安装令牌：从容器日志中获取。
- 数据库主机：使用上面的 Compose 配置时填写 `mysql`。
- 数据库端口：使用上面的 Compose 配置时填写 `3306`。
- 数据库名称：使用上面的 Compose 配置时填写 `liax_space`。
- 数据库用户名：使用上面的 Compose 配置时填写 `liax_space`。
- 数据库密码：填写 `.env` 中的 `MYSQL_PASSWORD`。
- 站点域名：例如 `https://blog.example.com`。
- 管理员邮箱。
- 管理员用户名。
- 管理员昵称。
- 管理员密码。

提交后，系统会将数据库连接、站点域名和管理员初始化信息写入持久化运行配置。随后容器会自动重启。重启后系统会执行数据库迁移、创建管理员账号、写入基础站点设置并完成初始化。初始化完成后，`/setup` 不再作为业务配置入口。
