CREATE TABLE `ArticleContentBlock` (
  `id` VARCHAR(191) NOT NULL,
  `articleId` VARCHAR(191) NOT NULL,
  `locale` VARCHAR(191) NOT NULL,
  `blockIndex` INTEGER NOT NULL,
  `anchorId` VARCHAR(191) NULL,
  `title` TEXT NULL,
  `level` INTEGER NULL,
  `html` LONGTEXT NOT NULL,
  `textLength` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ArticleContentBlock_articleId_locale_blockIndex_key`
  ON `ArticleContentBlock`(`articleId`, `locale`, `blockIndex`);

CREATE INDEX `ArticleContentBlock_articleId_locale_idx`
  ON `ArticleContentBlock`(`articleId`, `locale`);

CREATE INDEX `ArticleContentBlock_articleId_locale_anchorId_idx`
  ON `ArticleContentBlock`(`articleId`, `locale`, `anchorId`);

ALTER TABLE `ArticleContentBlock`
  ADD CONSTRAINT `ArticleContentBlock_articleId_fkey`
  FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
