CREATE TABLE tag_translations (
  tag_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(10) NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  UNIQUE KEY tag_translations_locale_slug_unique (locale, slug),
  UNIQUE KEY tag_translations_tag_locale_unique (tag_id, locale),
  CONSTRAINT tag_translations_tag_id_fk
    FOREIGN KEY (tag_id) REFERENCES tags (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

