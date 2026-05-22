CREATE TABLE `ArticleContent` (
  `id` VARCHAR(191) NOT NULL,
  `articleId` VARCHAR(191) NOT NULL,
  `locale` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `summary` TEXT NULL,
  `contentHtml` LONGTEXT NOT NULL,
  `contentJson` JSON NULL,
  `seoTitle` VARCHAR(191) NULL,
  `seoDescription` TEXT NULL,
  `contentStatus` ENUM('EMPTY', 'READY', 'STALE', 'FAILED') NOT NULL DEFAULT 'EMPTY',
  `contentHash` VARCHAR(64) NULL,
  `generatedFromLocale` VARCHAR(191) NULL,
  `generatedAt` DATETIME(3) NULL,
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ArticleContent_articleId_locale_key`
  ON `ArticleContent`(`articleId`, `locale`);

CREATE INDEX `ArticleContent_locale_contentStatus_idx`
  ON `ArticleContent`(`locale`, `contentStatus`);

CREATE INDEX `ArticleContent_contentHash_idx`
  ON `ArticleContent`(`contentHash`);

CREATE INDEX `ArticleContent_generatedFromLocale_idx`
  ON `ArticleContent`(`generatedFromLocale`);

ALTER TABLE `ArticleContent`
  ADD CONSTRAINT `ArticleContent_articleId_fkey`
  FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE `Article`
SET `sourceLocale` = CASE
  WHEN `sourceLocale` IN ('en', 'en-US') THEN 'en-US'
  ELSE 'zh-CN'
END;

INSERT INTO `ArticleContent` (
  `id`,
  `articleId`,
  `locale`,
  `title`,
  `summary`,
  `contentHtml`,
  `contentJson`,
  `seoTitle`,
  `seoDescription`,
  `contentStatus`,
  `contentHash`,
  `generatedFromLocale`,
  `generatedAt`,
  `error`,
  `createdAt`,
  `updatedAt`
)
SELECT
  CONCAT('ac_', REPLACE(UUID(), '-', '')),
  `Article`.`id`,
  CASE
    WHEN `Article`.`sourceLocale` IN ('en', 'en-US') THEN 'en-US'
    ELSE 'zh-CN'
  END,
  `Article`.`title`,
  `Article`.`summary`,
  `Article`.`contentHtml`,
  `Article`.`contentJson`,
  `Article`.`seoTitle`,
  `Article`.`seoDescription`,
  'READY',
  NULL,
  NULL,
  NULL,
  NULL,
  `Article`.`createdAt`,
  `Article`.`updatedAt`
FROM `Article`
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `summary` = VALUES(`summary`),
  `contentHtml` = VALUES(`contentHtml`),
  `contentJson` = VALUES(`contentJson`),
  `seoTitle` = VALUES(`seoTitle`),
  `seoDescription` = VALUES(`seoDescription`),
  `contentStatus` = 'READY',
  `error` = NULL,
  `updatedAt` = VALUES(`updatedAt`);

INSERT INTO `ArticleContent` (
  `id`,
  `articleId`,
  `locale`,
  `title`,
  `summary`,
  `contentHtml`,
  `contentJson`,
  `seoTitle`,
  `seoDescription`,
  `contentStatus`,
  `contentHash`,
  `generatedFromLocale`,
  `generatedAt`,
  `error`,
  `createdAt`,
  `updatedAt`
)
SELECT
  CONCAT('ac_', REPLACE(UUID(), '-', '')),
  `ArticleTranslation`.`articleId`,
  CASE
    WHEN `ArticleTranslation`.`locale` IN ('en', 'en-US') THEN 'en-US'
    ELSE 'zh-CN'
  END,
  `ArticleTranslation`.`title`,
  `ArticleTranslation`.`summary`,
  `ArticleTranslation`.`contentHtml`,
  `ArticleTranslation`.`contentJson`,
  `ArticleTranslation`.`seoTitle`,
  `ArticleTranslation`.`seoDescription`,
  CASE
    WHEN `ArticleTranslation`.`status` = 'TRANSLATED' THEN 'READY'
    WHEN `ArticleTranslation`.`status` = 'FAILED' THEN 'FAILED'
    ELSE 'EMPTY'
  END,
  `ArticleTranslation`.`contentHash`,
  CASE
    WHEN `Article`.`sourceLocale` IN ('en', 'en-US') THEN 'en-US'
    ELSE 'zh-CN'
  END,
  `ArticleTranslation`.`translatedAt`,
  `ArticleTranslation`.`error`,
  `ArticleTranslation`.`createdAt`,
  `ArticleTranslation`.`updatedAt`
FROM `ArticleTranslation`
INNER JOIN `Article`
  ON `Article`.`id` = `ArticleTranslation`.`articleId`
WHERE NOT EXISTS (
  SELECT 1
  FROM `ArticleContent`
  WHERE `ArticleContent`.`articleId` = `ArticleTranslation`.`articleId`
    AND `ArticleContent`.`locale` = CASE
      WHEN `ArticleTranslation`.`locale` IN ('en', 'en-US') THEN 'en-US'
      ELSE 'zh-CN'
    END
);
