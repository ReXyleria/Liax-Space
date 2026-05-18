CREATE TABLE `ArticleTranslationJob` (
  `id` VARCHAR(191) NOT NULL,
  `articleId` VARCHAR(191) NOT NULL,
  `locale` VARCHAR(191) NOT NULL,
  `status` ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'QUEUED',
  `progress` INTEGER NOT NULL DEFAULT 0,
  `completedUnits` INTEGER NOT NULL DEFAULT 0,
  `totalUnits` INTEGER NOT NULL DEFAULT 0,
  `progressMessage` TEXT NULL,
  `error` TEXT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ArticleTranslationJob_articleId_locale_createdAt_idx`
  ON `ArticleTranslationJob`(`articleId`, `locale`, `createdAt`);

CREATE INDEX `ArticleTranslationJob_status_createdAt_idx`
  ON `ArticleTranslationJob`(`status`, `createdAt`);

CREATE INDEX `ArticleTranslationJob_createdById_idx`
  ON `ArticleTranslationJob`(`createdById`);

ALTER TABLE `ArticleTranslationJob`
  ADD CONSTRAINT `ArticleTranslationJob_articleId_fkey`
  FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ArticleTranslationJob`
  ADD CONSTRAINT `ArticleTranslationJob_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
