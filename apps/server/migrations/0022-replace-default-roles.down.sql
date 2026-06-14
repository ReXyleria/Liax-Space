INSERT INTO role_definitions (role_key, display_name, permissions_json, built_in)
VALUES
  ('admin', 'Admin', JSON_ARRAY('article:create', 'article:update', 'article:publish', 'article:delete', 'attachment:upload', 'user:manage', 'system:maintain'), TRUE),
  ('editor', 'Editor', JSON_ARRAY('article:create', 'article:update', 'article:publish', 'attachment:upload'), TRUE),
  ('viewer', 'Viewer', JSON_ARRAY(), TRUE)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  permissions_json = VALUES(permissions_json),
  built_in = TRUE;

UPDATE users SET role = 'editor' WHERE role = 'ssvip';
UPDATE users SET role = 'viewer' WHERE role IN ('svip', 'guest');

UPDATE article_translations AS t
SET t.allowed_roles_json = (
  SELECT COALESCE(JSON_ARRAYAGG(mapped_role), JSON_ARRAY())
  FROM (
    SELECT DISTINCT
      CASE role_value
        WHEN 'ssvip' THEN 'editor'
        WHEN 'svip' THEN 'viewer'
        WHEN 'guest' THEN 'viewer'
        ELSE role_value
      END AS mapped_role
    FROM JSON_TABLE(
      COALESCE(t.allowed_roles_json, JSON_ARRAY()),
      '$[*]' COLUMNS(role_value VARCHAR(32) PATH '$')
    ) AS allowed_roles
    WHERE role_value IN ('admin', 'ssvip', 'svip', 'guest', 'editor', 'viewer')
  ) AS mapped_roles
)
WHERE t.allowed_roles_json IS NOT NULL;

DELETE FROM role_definitions WHERE role_key IN ('ssvip', 'svip', 'guest');
