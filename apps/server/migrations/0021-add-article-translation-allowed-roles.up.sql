ALTER TABLE article_translations
  ADD COLUMN allowed_roles_json JSON NULL AFTER published_at;
