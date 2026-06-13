import type { ArticleLocale, ArticleTranslation } from "./articleApi";
import { httpClient } from "./httpClient";

export type ArticleVersion = {
  id: number;
  articleId: number;
  locale: ArticleLocale;
  versionNo: number;
  mdContent: string;
  contentHash: string;
  renderHash: string | null;
  htmlPath: string | null;
  renderStatus: string;
  rendererVersion: string | null;
  templateVersion: string | null;
  customRuleVersion: string | null;
  createdBy: number;
  createdAt: string;
  isPublishedSnapshot: boolean;
  isPinned: boolean;
};

export type ListVersionsResponse = {
  versions: ArticleVersion[];
};

export type GetVersionResponse = {
  version: ArticleVersion;
};

export type SaveVersionRequest = {
  baseVersionId: number | null;
  mdContent: string;
};

export type SaveVersionResponse = {
  unchanged: boolean;
  version: ArticleVersion;
};

export type RollbackVersionResponse = {
  version: ArticleVersion;
};

export type PublishVersionResponse = {
  version: ArticleVersion;
  translation: ArticleTranslation;
  htmlPath: string;
};

export type PublishVersionRequest = {
  allowedRoles?: string[];
};

export const versionApi = {
  listVersions(articleId: number, locale: ArticleLocale): Promise<ListVersionsResponse> {
    return httpClient.get<ListVersionsResponse>(`/admin/articles/${articleId}/${locale}/versions`);
  },
  getVersion(articleId: number, locale: ArticleLocale, versionId: number): Promise<GetVersionResponse> {
    return httpClient.get<GetVersionResponse>(`/admin/articles/${articleId}/${locale}/versions/${versionId}`);
  },
  saveVersion(
    articleId: number,
    locale: ArticleLocale,
    input: SaveVersionRequest
  ): Promise<SaveVersionResponse> {
    return httpClient.post<SaveVersionResponse>(`/admin/articles/${articleId}/${locale}/versions`, input);
  },
  publishVersion(
    articleId: number,
    locale: ArticleLocale,
    versionId: number,
    input: PublishVersionRequest = {}
  ): Promise<PublishVersionResponse> {
    return httpClient.post<PublishVersionResponse>(`/admin/articles/${articleId}/${locale}/publish`, {
      allowedRoles: input.allowedRoles ?? [],
      versionId
    });
  },
  rollbackVersion(articleId: number, locale: ArticleLocale, targetVersionId: number): Promise<RollbackVersionResponse> {
    return httpClient.post<RollbackVersionResponse>(`/admin/articles/${articleId}/${locale}/rollback`, {
      targetVersionId
    });
  },
  pinVersion(articleId: number, locale: ArticleLocale, versionId: number): Promise<GetVersionResponse> {
    return httpClient.post<GetVersionResponse>(`/admin/articles/${articleId}/${locale}/versions/${versionId}/pin`, {});
  },
  unpinVersion(articleId: number, locale: ArticleLocale, versionId: number): Promise<GetVersionResponse> {
    return httpClient.post<GetVersionResponse>(`/admin/articles/${articleId}/${locale}/versions/${versionId}/unpin`, {});
  }
};
