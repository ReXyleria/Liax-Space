CREATE TABLE `ArticleTranslationChunk` (
  `id` VARCHAR(191) NOT NULL,
  `articleId` VARCHAR(191) NOT NULL,
  `locale` VARCHAR(191) NOT NULL,
  `sourceHash` VARCHAR(64) NOT NULL,
  `chunkIndex` INTEGER NOT NULL,
  `sourceHtml` LONGTEXT NOT NULL,
  `translatedHtml` LONGTEXT NULL,
  `status` ENUM('NOT_TRANSLATED', 'TRANSLATING', 'TRANSLATED', 'FAILED') NOT NULL DEFAULT 'NOT_TRANSLATED',
  `error` TEXT NULL,
  `translatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ATC_article_locale_hash_chunk_key`(`articleId`, `locale`, `sourceHash`, `chunkIndex`),
  INDEX `ATC_article_locale_hash_status_idx`(`articleId`, `locale`, `sourceHash`, `status`),
  INDEX `ATC_status_updatedAt_idx`(`status`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ArticleTranslationChunk`
  ADD CONSTRAINT `ArticleTranslationChunk_articleId_fkey`
  FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
