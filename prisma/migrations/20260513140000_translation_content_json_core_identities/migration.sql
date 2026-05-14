-- Store editable rich-text JSON for translated article content.
ALTER TABLE `ArticleTranslation`
    ADD COLUMN `contentJson` JSON NULL;
