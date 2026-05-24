ALTER TABLE `Article`
  ADD INDEX `Article_status_deletedAt_pinned_publishedAt_idx` (`status`, `deletedAt`, `pinned`, `publishedAt`);

ALTER TABLE `VisitLog`
  ADD INDEX `VisitLog_createdAt_countryCode_idx` (`createdAt`, `countryCode`),
  ADD INDEX `VisitLog_createdAt_searchEngine_idx` (`createdAt`, `searchEngine`);

ALTER TABLE `SitePushRecord`
  ADD COLUMN `urlHash` VARCHAR(64) NULL,
  ADD INDEX `SitePushRecord_provider_urlHash_status_submittedAt_idx` (`provider`, `urlHash`, `status`, `submittedAt`);
