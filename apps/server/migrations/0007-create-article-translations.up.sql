CREATE TABLE article_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(10) NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  seo_title VARCHAR(255) NULL DEFAULT NULL,
  seo_description TEXT NULL DEFAULT NULL,
  summary TEXT NULL DEFAULT NULL,
  current_version_id BIGINT UNSIGNED NULL DEFAULT NULL,
  published_version_id BIGINT UNSIGNED NULL DEFAULT NULL,
  current_html_path VARCHAR(1024) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY article_translations_article_locale_unique (article_id, locale),
  UNIQUE KEY article_translations_locale_slug_unique (locale, slug),
  KEY article_translations_locale_index (locale),
  CONSTRAINT article_translations_article_id_fk
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

