# Translation Module

## 模块职责

负责后台自动翻译的服务端 API 接入，默认使用 DeepSeek Chat Completions，将文章元数据或正文内容从一种语言翻译到另一种语言。

## 不负责什么

不保存文章，不发布 HTML，不在前端暴露 API key，不替代人工校对。

## 未来主要文件

- TranslationService.ts
- translation.routes.ts
- provider-specific adapters
