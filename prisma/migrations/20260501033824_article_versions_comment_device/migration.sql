-- AlterTable
ALTER TABLE `comment` ADD COLUMN `deviceName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ArticleVersion` (
    `id` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `cover` VARCHAR(191) NULL,
    `contentJson` JSON NOT NULL,
    `contentHtml` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL,
    `visibility` ENUM('PUBLIC', 'LOGIN_REQUIRED', 'FRIEND_ONLY', 'VIP_ONLY', 'EDITOR_ONLY', 'ADMIN_ONLY', 'OWNER_ONLY') NOT NULL,
    `allowComments` BOOLEAN NOT NULL,
    `pinned` BOOLEAN NOT NULL,
    `featured` BOOLEAN NOT NULL,
    `seoTitle` VARCHAR(191) NULL,
    `seoDescription` TEXT NULL,
    `tagNames` JSON NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ArticleVersion_articleId_createdAt_idx`(`articleId`, `createdAt`),
    INDEX `ArticleVersion_createdById_idx`(`createdById`),
    UNIQUE INDEX `ArticleVersion_articleId_version_key`(`articleId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ArticleVersion` ADD CONSTRAINT `ArticleVersion_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArticleVersion` ADD CONSTRAINT `ArticleVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
