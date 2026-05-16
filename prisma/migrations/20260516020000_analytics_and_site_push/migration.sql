-- AlterTable
ALTER TABLE `VisitLog`
  ADD COLUMN `referrerHost` VARCHAR(191) NULL,
  ADD COLUMN `searchEngine` VARCHAR(191) NULL,
  ADD COLUMN `countryCode` VARCHAR(16) NULL;

-- CreateTable
CREATE TABLE `SitePushRecord` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('BAIDU', 'BING', 'GOOGLE') NOT NULL,
    `url` TEXT NOT NULL,
    `action` ENUM('MANUAL', 'BATCH', 'AUTO') NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `httpStatus` INTEGER NULL,
    `responseBody` TEXT NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,

    INDEX `SitePushRecord_provider_idx`(`provider`),
    INDEX `SitePushRecord_status_idx`(`status`),
    INDEX `SitePushRecord_createdAt_idx`(`createdAt`),
    INDEX `SitePushRecord_submittedAt_idx`(`submittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `VisitLog_countryCode_idx` ON `VisitLog`(`countryCode`);

-- CreateIndex
CREATE INDEX `VisitLog_searchEngine_idx` ON `VisitLog`(`searchEngine`);
