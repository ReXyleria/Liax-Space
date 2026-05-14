-- CreateTable
CREATE TABLE `MailTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `scene` ENUM('MOMENT_COMMENT', 'LOGIN_ALERT', 'COMMENT_REPLY', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'CUSTOM_PAGE_COMMENT', 'ARTICLE_COMMENT', 'GUESTBOOK_REPLY', 'REGISTER_CODE') NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `bodyHtml` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MailTemplate_scene_key`(`scene`),
    INDEX `MailTemplate_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MailSendLog` (
    `id` VARCHAR(191) NOT NULL,
    `scene` ENUM('MOMENT_COMMENT', 'LOGIN_ALERT', 'COMMENT_REPLY', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'CUSTOM_PAGE_COMMENT', 'ARTICLE_COMMENT', 'GUESTBOOK_REPLY', 'REGISTER_CODE') NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `status` ENUM('SENT', 'FAILED', 'SKIPPED') NOT NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MailSendLog_scene_idx`(`scene`),
    INDEX `MailSendLog_status_idx`(`status`),
    INDEX `MailSendLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
