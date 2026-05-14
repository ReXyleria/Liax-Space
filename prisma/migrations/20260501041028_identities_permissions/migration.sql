-- AlterTable
ALTER TABLE `user` ADD COLUMN `identityId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Identity` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `permissions` JSON NOT NULL,
    `builtInRole` ENUM('VISITOR', 'USER', 'FRIEND', 'VIP', 'EDITOR', 'ADMIN', 'OWNER') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Identity_key_key`(`key`),
    INDEX `Identity_builtInRole_idx`(`builtInRole`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_identityId_idx` ON `User`(`identityId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_identityId_fkey` FOREIGN KEY (`identityId`) REFERENCES `Identity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
