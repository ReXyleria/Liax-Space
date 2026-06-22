CREATE TABLE translation_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('translate', 'seo') NOT NULL,
  status ENUM('queued', 'running', 'succeeded', 'failed') NOT NULL DEFAULT 'queued',
  input_json JSON NOT NULL,
  result_json JSON NULL,
  error_message TEXT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_at DATETIME NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY translation_jobs_status_created_index (status, created_at, id),
  KEY translation_jobs_kind_status_index (kind, status)
);
