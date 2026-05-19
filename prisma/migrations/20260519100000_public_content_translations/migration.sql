-- CreateTable
CREATE TABLE `PublicContentTranslation` (
    `id` VARCHAR(191) NOT NULL,
    `entity` ENUM('TAG', 'MOMENT', 'MOMENT_COMMENT', 'GUESTBOOK_MESSAGE', 'GUESTBOOK_COMMENT', 'SETTING') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL,
    `fields` JSON NOT NULL,
    `status` ENUM('NOT_TRANSLATED', 'TRANSLATING', 'TRANSLATED', 'FAILED') NOT NULL DEFAULT 'NOT_TRANSLATED',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `sourceHash` VARCHAR(64) NULL,
    `sourceUpdatedAt` DATETIME(3) NULL,
    `translatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PublicContentTranslation_entity_entityId_locale_key`(`entity`, `entityId`, `locale`),
    INDEX `PublicContentTranslation_entity_locale_status_idx`(`entity`, `locale`, `status`),
    INDEX `PublicContentTranslation_sourceHash_idx`(`sourceHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublicContentTranslationJob` (
    `id` VARCHAR(191) NOT NULL,
    `entity` ENUM('TAG', 'MOMENT', 'MOMENT_COMMENT', 'GUESTBOOK_MESSAGE', 'GUESTBOOK_COMMENT', 'SETTING') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL,
    `fields` JSON NOT NULL,
    `sourceHash` VARCHAR(64) NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'QUEUED',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PublicContentTranslationJob_entity_entityId_locale_createdAt_idx`(`entity`, `entityId`, `locale`, `createdAt`),
    INDEX `PublicContentTranslationJob_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `PublicContentTranslationJob_sourceHash_idx`(`sourceHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
