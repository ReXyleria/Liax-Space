-- AlterTable
ALTER TABLE `Comment`
  ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX `Comment_articleId_status_idx` ON `Comment`;

-- CreateIndex
CREATE INDEX `Comment_articleId_status_pinned_idx` ON `Comment`(`articleId`, `status`, `pinned`);
