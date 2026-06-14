CREATE TABLE role_definitions (
  role_key VARCHAR(32) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  permissions_json JSON NOT NULL,
  built_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO role_definitions (role_key, display_name, permissions_json, built_in)
VALUES
  ('admin', 'Administrator', JSON_ARRAY('article:create', 'article:update', 'article:publish', 'article:delete', 'attachment:upload', 'user:manage', 'system:maintain'), TRUE),
  ('ssvip', 'SSVIP', JSON_ARRAY(), TRUE),
  ('svip', 'SVIP', JSON_ARRAY(), TRUE),
  ('guest', 'Guest', JSON_ARRAY(), TRUE);
