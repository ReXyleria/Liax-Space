-- AlterTable
ALTER TABLE `mediaasset` ADD COLUMN `isUnused` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastScannedAt` DATETIME(3) NULL,
    ADD COLUMN `unusedSince` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `MediaReference` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `source` ENUM('ARTICLE', 'MOMENT', 'PAGE') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MediaReference_source_sourceId_idx`(`source`, `sourceId`),
    UNIQUE INDEX `MediaReference_assetId_source_sourceId_key`(`assetId`, `source`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `MediaAsset_isUnused_unusedSince_idx` ON `MediaAsset`(`isUnused`, `unusedSince`);

-- AddForeignKey
ALTER TABLE `MediaReference` ADD CONSTRAINT `MediaReference_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `MediaAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
