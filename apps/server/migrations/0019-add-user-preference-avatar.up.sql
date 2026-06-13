ALTER TABLE user_preferences
  ADD COLUMN avatar_attachment_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER reduced_motion,
  ADD KEY user_preferences_avatar_attachment_id_index (avatar_attachment_id),
  ADD CONSTRAINT user_preferences_avatar_attachment_id_fk
    FOREIGN KEY (avatar_attachment_id) REFERENCES attachments (id)
    ON DELETE SET NULL;
