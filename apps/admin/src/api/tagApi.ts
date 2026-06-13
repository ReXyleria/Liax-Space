import type { ArticleLocale } from "./articleApi";
import { httpClient } from "./httpClient";

export type Tag = {
  id: number;
  createdAt: string;
};

export type TagTranslation = {
  tagId: number;
  locale: ArticleLocale;
  name: string;
  slug: string;
};

export type TagDetail = {
  tag: Tag;
  translations: TagTranslation[];
};

export type TagTranslationInput = {
  locale: ArticleLocale;
  name: string;
  slug: string;
};

export type ListTagsResponse = {
  tags: TagDetail[];
};

export type TagResponse = {
  tag: TagDetail;
};

export type ReplaceArticleTagsResponse = {
  articleId: number;
  tags: TagDetail[];
};

export const tagApi = {
  listTags(): Promise<ListTagsResponse> {
    return httpClient.get<ListTagsResponse>("/admin/tags");
  },
  createTag(translations: TagTranslationInput[]): Promise<TagResponse> {
    return httpClient.post<TagResponse>("/admin/tags", { translations });
  },
  updateTranslation(tagId: number, locale: ArticleLocale, input: Omit<TagTranslationInput, "locale">): Promise<TagResponse> {
    return httpClient.patch<TagResponse>(`/admin/tags/${tagId}/translations/${locale}`, input);
  },
  deleteTag(tagId: number): Promise<TagResponse> {
    return httpClient.delete<TagResponse>(`/admin/tags/${tagId}`);
  },
  replaceArticleTags(articleId: number, tagIds: number[]): Promise<ReplaceArticleTagsResponse> {
    return httpClient.post<ReplaceArticleTagsResponse>(`/admin/articles/${articleId}/tags`, { tagIds });
  }
};
