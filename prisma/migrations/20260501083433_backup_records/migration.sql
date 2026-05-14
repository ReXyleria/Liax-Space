-- CreateTable
CREATE TABLE `BackupRecord` (
    `id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `filePath` TEXT NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `status` ENUM('READY', 'FAILED') NOT NULL DEFAULT 'READY',
    `reason` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BackupRecord_status_idx`(`status`),
    INDEX `BackupRecord_createdAt_idx`(`createdAt`),
    INDEX `BackupRecord_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
