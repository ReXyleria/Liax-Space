CREATE TABLE category_translations (
  category_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(10) NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  UNIQUE KEY category_translations_locale_slug_unique (locale, slug),
  UNIQUE KEY category_translations_category_locale_unique (category_id, locale),
  CONSTRAINT category_translations_category_id_fk
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

