CREATE TABLE `LoginEvent` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `method` ENUM('PASSWORD', 'EMAIL_CODE', 'TOTP', 'RECOVERY', 'PASSKEY', 'SMTP_FAIL_OPEN') NOT NULL,
  `deviceName` VARCHAR(191) NULL,
  `ipHash` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `LoginEvent_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `LoginEvent_method_createdAt_idx`(`method`, `createdAt`),
  INDEX `LoginEvent_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LoginEvent`
  ADD CONSTRAINT `LoginEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
