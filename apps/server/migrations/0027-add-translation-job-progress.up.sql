ALTER TABLE translation_jobs
  ADD COLUMN progress_total INT UNSIGNED NOT NULL DEFAULT 1 AFTER attempts,
  ADD COLUMN progress_completed INT UNSIGNED NOT NULL DEFAULT 0 AFTER progress_total;
