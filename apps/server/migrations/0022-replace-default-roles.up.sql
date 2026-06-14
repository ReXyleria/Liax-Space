INSERT INTO role_definitions (role_key, display_name, permissions_json, built_in)
VALUES
  ('admin', 'Administrator', JSON_ARRAY('article:create', 'article:update', 'article:publish', 'article:delete', 'attachment:upload', 'user:manage', 'system:maintain'), TRUE),
  ('ssvip', 'SSVIP', JSON_ARRAY(), TRUE),
  ('svip', 'SVIP', JSON_ARRAY(), TRUE),
  ('guest', 'Guest', JSON_ARRAY(), TRUE)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  permissions_json = VALUES(permissions_json),
  built_in = TRUE;

UPDATE users SET role = 'ssvip' WHERE role = 'editor';
UPDATE users SET role = 'svip' WHERE role = 'viewer';

UPDATE article_translations AS t
SET t.allowed_roles_json = (
  SELECT COALESCE(JSON_ARRAYAGG(mapped_role), JSON_ARRAY())
  FROM (
    SELECT DISTINCT
      CASE role_value
        WHEN 'editor' THEN 'ssvip'
        WHEN 'viewer' THEN 'svip'
        ELSE role_value
      END AS mapped_role
    FROM JSON_TABLE(
      COALESCE(t.allowed_roles_json, JSON_ARRAY()),
      '$[*]' COLUMNS(role_value VARCHAR(32) PATH '$')
    ) AS allowed_roles
    WHERE role_value IN ('admin', 'editor', 'viewer', 'ssvip', 'svip', 'guest')
  ) AS mapped_roles
)
WHERE t.allowed_roles_json IS NOT NULL;

DELETE FROM role_definitions WHERE role_key IN ('editor', 'viewer');
