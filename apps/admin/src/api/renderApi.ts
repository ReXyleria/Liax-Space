import type { ArticleLocale } from "./articleApi";
import { httpClient } from "./httpClient";

export type PreviewMarkdownRequest = {
  locale: ArticleLocale;
  mdContent: string;
};

export type PreviewMarkdownResponse = {
  html: string;
};

export const renderApi = {
  previewMarkdown(input: PreviewMarkdownRequest): Promise<PreviewMarkdownResponse> {
    return httpClient.post<PreviewMarkdownResponse>("/admin/render/preview", input);
  }
};
