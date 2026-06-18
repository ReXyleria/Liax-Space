CREATE TABLE seo_push_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider ENUM('baidu', 'indexnow', 'google') NOT NULL,
  status ENUM('success', 'failed', 'skipped') NOT NULL,
  submitted_count INT UNSIGNED NOT NULL DEFAULT 0,
  status_code INT NULL DEFAULT NULL,
  request_url VARCHAR(1000) NULL DEFAULT NULL,
  message TEXT NULL DEFAULT NULL,
  urls_json JSON NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY seo_push_submissions_provider_created_at_index (provider, created_at),
  KEY seo_push_submissions_status_created_at_index (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
