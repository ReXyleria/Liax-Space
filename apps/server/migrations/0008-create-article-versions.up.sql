CREATE TABLE article_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(10) NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  md_content MEDIUMTEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  render_hash CHAR(64) NULL DEFAULT NULL,
  html_path VARCHAR(1024) NULL DEFAULT NULL,
  render_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  renderer_version VARCHAR(64) NULL DEFAULT NULL,
  template_version VARCHAR(64) NULL DEFAULT NULL,
  custom_rule_version VARCHAR(64) NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_published_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  UNIQUE KEY article_versions_article_locale_version_unique (article_id, locale, version_no),
  KEY article_versions_article_id_index (article_id),
  KEY article_versions_locale_index (locale),
  KEY article_versions_content_hash_index (content_hash),
  KEY article_versions_render_status_index (render_status),
  KEY article_versions_created_by_index (created_by),
  CONSTRAINT article_versions_article_id_fk
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE,
  CONSTRAINT article_versions_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

