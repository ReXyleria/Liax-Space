-- AlterTable
ALTER TABLE `Comment`
  ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Comment_articleId_status_pinned_idx` ON `Comment`(`articleId`, `status`, `pinned`);

-- DropIndex
DROP INDEX `Comment_articleId_status_idx` ON `Comment`;
