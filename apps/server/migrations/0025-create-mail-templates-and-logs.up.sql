CREATE TABLE mail_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(120) NOT NULL,
  locale ENUM('zh-CN', 'en-US') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_text TEXT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mail_templates_key_locale_unique (`key`, locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mail_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_key VARCHAR(120) NOT NULL,
  recipient VARCHAR(320) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status ENUM('success', 'failed', 'skipped') NOT NULL,
  message TEXT NULL DEFAULT NULL,
  provider_response TEXT NULL DEFAULT NULL,
  related_type VARCHAR(80) NULL DEFAULT NULL,
  related_id BIGINT UNSIGNED NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY mail_logs_template_created_at_index (template_key, created_at),
  KEY mail_logs_status_created_at_index (status, created_at),
  KEY mail_logs_related_index (related_type, related_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO mail_templates (`key`, locale, subject, body_text, enabled) VALUES
  (
    'guestbook.notification',
    'zh-CN',
    '新的留言：{{authorName}}',
    '站点收到一条新的留言。\n\n作者：{{authorName}}\n邮箱：{{email}}\n语言：{{locale}}\n类型：{{visibility}}\n时间：{{createdAt}}\n\n内容：\n{{content}}\n\n后台查看：{{adminUrl}}',
    1
  ),
  (
    'guestbook.notification',
    'en-US',
    'New guestbook message from {{authorName}}',
    'A new guestbook message was submitted.\n\nAuthor: {{authorName}}\nEmail: {{email}}\nLocale: {{locale}}\nVisibility: {{visibility}}\nTime: {{createdAt}}\n\nContent:\n{{content}}\n\nReview in console: {{adminUrl}}',
    1
  );
