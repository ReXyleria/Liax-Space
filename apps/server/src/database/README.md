# database

## 模块职责

管理数据库连接、迁移入口、事务边界和数据访问基础设施。

## 不负责什么

不负责定义业务流程，不直接处理 HTTP 请求，不保存上传文件。

## 未来主要文件

- `connection.ts`
- `migrations.ts`
- `transaction.ts`

