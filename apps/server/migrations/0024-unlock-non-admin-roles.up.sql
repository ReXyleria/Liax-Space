UPDATE role_definitions
SET built_in = CASE WHEN role_key = 'admin' THEN TRUE ELSE FALSE END
WHERE role_key IN ('admin', 'ssvip', 'svip', 'guest');

UPDATE role_definitions
SET display_name = 'Administer'
WHERE role_key = 'admin';
