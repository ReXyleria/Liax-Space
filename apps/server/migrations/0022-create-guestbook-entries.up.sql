CREATE TABLE guestbook_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  locale VARCHAR(10) NOT NULL,
  author_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NULL DEFAULT NULL,
  content TEXT NOT NULL,
  notify_only TINYINT(1) NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY guestbook_entries_locale_public_index (locale, is_public, notify_only, created_at),
  KEY guestbook_entries_deleted_at_index (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
