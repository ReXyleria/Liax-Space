-- AlterTable
ALTER TABLE `article` ADD COLUMN `rawImportMeta` JSON NULL;

-- AlterTable
ALTER TABLE `comment` ADD COLUMN `rawImportMeta` JSON NULL;

-- AlterTable
ALTER TABLE `mediaasset` ADD COLUMN `rawImportMeta` JSON NULL;

-- AlterTable
ALTER TABLE `moment` ADD COLUMN `rawImportMeta` JSON NULL;

-- AlterTable
ALTER TABLE `tag` ADD COLUMN `rawImportMeta` JSON NULL;
