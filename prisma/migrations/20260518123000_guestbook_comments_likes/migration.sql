CREATE TABLE `GuestbookComment` (
  `id` VARCHAR(191) NOT NULL,
  `messageId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `nickname` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GuestbookLike` (
  `messageId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`messageId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `GuestbookComment_messageId_createdAt_idx`
  ON `GuestbookComment`(`messageId`, `createdAt`);

CREATE INDEX `GuestbookComment_userId_idx`
  ON `GuestbookComment`(`userId`);

CREATE INDEX `GuestbookComment_deletedAt_idx`
  ON `GuestbookComment`(`deletedAt`);

CREATE INDEX `GuestbookLike_userId_idx`
  ON `GuestbookLike`(`userId`);

ALTER TABLE `GuestbookComment`
  ADD CONSTRAINT `GuestbookComment_messageId_fkey`
  FOREIGN KEY (`messageId`) REFERENCES `GuestbookMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GuestbookComment`
  ADD CONSTRAINT `GuestbookComment_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GuestbookLike`
  ADD CONSTRAINT `GuestbookLike_messageId_fkey`
  FOREIGN KEY (`messageId`) REFERENCES `GuestbookMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GuestbookLike`
  ADD CONSTRAINT `GuestbookLike_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
