CREATE TABLE article_categories (
  article_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (article_id),
  KEY article_categories_category_id_index (category_id),
  CONSTRAINT article_categories_article_id_fk
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE,
  CONSTRAINT article_categories_category_id_fk
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

