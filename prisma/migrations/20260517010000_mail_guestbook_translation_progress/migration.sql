-- AlterEnum
ALTER TABLE `MailTemplate`
  MODIFY `scene` ENUM('MOMENT_COMMENT', 'LOGIN_ALERT', 'LOGIN_CODE', 'COMMENT_REPLY', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'CUSTOM_PAGE_COMMENT', 'ARTICLE_COMMENT', 'GUESTBOOK_REPLY', 'REGISTER_CODE') NOT NULL;

ALTER TABLE `MailSendLog`
  MODIFY `scene` ENUM('MOMENT_COMMENT', 'LOGIN_ALERT', 'LOGIN_CODE', 'COMMENT_REPLY', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'CUSTOM_PAGE_COMMENT', 'ARTICLE_COMMENT', 'GUESTBOOK_REPLY', 'REGISTER_CODE') NOT NULL;

-- AlterTable
ALTER TABLE `ArticleTranslation`
  ADD COLUMN `progress` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `completedUnits` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `totalUnits` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `progressMessage` TEXT NULL;

-- AlterTable
ALTER TABLE `GuestbookMessage`
  ADD COLUMN `userId` VARCHAR(191) NULL,
  ADD COLUMN `notifyOnly` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `GuestbookMessage_userId_idx` ON `GuestbookMessage`(`userId`);

-- CreateIndex
CREATE INDEX `GuestbookMessage_notifyOnly_status_idx` ON `GuestbookMessage`(`notifyOnly`, `status`);

-- AddForeignKey
ALTER TABLE `GuestbookMessage`
  ADD CONSTRAINT `GuestbookMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
