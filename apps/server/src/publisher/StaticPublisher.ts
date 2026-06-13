import { join } from "node:path";

import { atomicWriteFile } from "../common/fs/atomicWriteFile.js";
import { storagePaths } from "../config/paths.js";
import type { ArticleVersionLocale } from "../versions/versions.types.js";

export type StaticPublishInput = {
  articleId: number;
  locale: ArticleVersionLocale;
  versionId: number;
  html: string;
};

export type StaticPublishResult = {
  absolutePath: string;
  htmlPath: string;
};

export class StaticPublisher {
  async publishArticleHtml(input: StaticPublishInput): Promise<StaticPublishResult> {
    const htmlPath = `${input.locale}/articles/${input.articleId}/${input.versionId}/index.html`;
    const absolutePath = join(storagePaths.renderedDir, input.locale, "articles", String(input.articleId), String(input.versionId), "index.html");

    await atomicWriteFile(absolutePath, input.html);

    return {
      absolutePath,
      htmlPath
    };
  }
}
