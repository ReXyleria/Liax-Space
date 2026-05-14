-- Add identity-based article viewer restrictions.
CREATE TABLE `ArticleAllowedIdentity` (
    `articleId` VARCHAR(191) NOT NULL,
    `identityId` VARCHAR(191) NOT NULL,

    INDEX `ArticleAllowedIdentity_identityId_idx`(`identityId`),
    PRIMARY KEY (`articleId`, `identityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ArticleAllowedIdentity`
    ADD CONSTRAINT `ArticleAllowedIdentity_articleId_fkey`
    FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ArticleAllowedIdentity`
    ADD CONSTRAINT `ArticleAllowedIdentity_identityId_fkey`
    FOREIGN KEY (`identityId`) REFERENCES `Identity`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ArticleVersion`
    ADD COLUMN `allowedIdentityIds` JSON NULL;
