CREATE TABLE article_version_attachments (
  article_version_id BIGINT UNSIGNED NOT NULL,
  attachment_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (article_version_id, attachment_id),
  KEY article_version_attachments_attachment_id_index (attachment_id),
  CONSTRAINT article_version_attachments_version_id_fk
    FOREIGN KEY (article_version_id) REFERENCES article_versions (id)
    ON DELETE CASCADE,
  CONSTRAINT article_version_attachments_attachment_id_fk
    FOREIGN KEY (attachment_id) REFERENCES attachments (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

