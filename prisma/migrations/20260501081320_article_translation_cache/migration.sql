-- AlterTable
ALTER TABLE `articletranslation` ADD COLUMN `contentHash` VARCHAR(64) NULL,
    ADD COLUMN `sourceUpdatedAt` DATETIME(3) NULL,
    ADD COLUMN `translatedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `ArticleTranslation_contentHash_idx` ON `ArticleTranslation`(`contentHash`);
