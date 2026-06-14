UPDATE role_definitions
SET built_in = TRUE
WHERE role_key IN ('admin', 'ssvip', 'svip', 'guest');

UPDATE role_definitions
SET display_name = 'Administrator'
WHERE role_key = 'admin';
