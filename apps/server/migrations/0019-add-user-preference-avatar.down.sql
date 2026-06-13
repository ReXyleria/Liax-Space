ALTER TABLE user_preferences
  DROP FOREIGN KEY user_preferences_avatar_attachment_id_fk,
  DROP KEY user_preferences_avatar_attachment_id_index,
  DROP COLUMN avatar_attachment_id;
