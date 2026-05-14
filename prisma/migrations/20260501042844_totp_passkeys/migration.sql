/*
  Warnings:

  - Added the required column `updatedAt` to the `PasskeyCredential` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `passkeycredential` ADD COLUMN `backedUp` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `credentialDeviceType` VARCHAR(191) NULL,
    ADD COLUMN `transports` TEXT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `totpConfirmedAt` DATETIME(3) NULL,
    ADD COLUMN `totpEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `totpSecret` TEXT NULL;

-- CreateTable
CREATE TABLE `TotpRecoveryCode` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TotpRecoveryCode_userId_usedAt_idx`(`userId`, `usedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebAuthnChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `challenge` VARCHAR(191) NOT NULL,
    `type` ENUM('REGISTRATION', 'AUTHENTICATION') NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebAuthnChallenge_challenge_key`(`challenge`),
    INDEX `WebAuthnChallenge_userId_type_idx`(`userId`, `type`),
    INDEX `WebAuthnChallenge_expiresAt_idx`(`expiresAt`),
    INDEX `WebAuthnChallenge_usedAt_idx`(`usedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TotpRecoveryCode` ADD CONSTRAINT `TotpRecoveryCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebAuthnChallenge` ADD CONSTRAINT `WebAuthnChallenge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
