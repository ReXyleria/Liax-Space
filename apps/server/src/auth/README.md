# auth

## 模块职责

处理密码登录、会话签发、会话校验和退出登录。

## 不负责什么

不负责 TOTP secret 管理、Passkey 凭据管理、角色权限定义或文章业务。

## 未来主要文件

- `auth-service.ts`
- `password-hasher.ts`
- `session-service.ts`
- `auth-routes.ts`

