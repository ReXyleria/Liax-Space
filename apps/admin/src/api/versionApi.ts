import type { ArticleLocale, ArticleTranslation } from "./articleApi";
import { ApiError, buildApiUrl, httpClient, readAuthToken } from "./httpClient";

export type ArticleVersion = {
  id: number;
  articleId: number;
  locale: ArticleLocale;
  versionNo: number;
  mdContent?: string;
  contentSizeBytes?: number;
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

export type ArticleVersionSummary = Omit<ArticleVersion, "mdContent"> & {
  contentSizeBytes: number;
  mdContent?: undefined;
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

export type ImportMarkdownVersionResponse = {
  unchanged: boolean;
  version: ArticleVersionSummary;
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
  publishedAt?: string | null;
};

function parseJsonResponse(value: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return { message: value };
  }
}

function readErrorPayload(value: unknown): { code?: string; details?: unknown; message?: string; requestId?: string } {
  if (value === null || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const source = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : record;

  return {
    code: typeof source.code === "string" ? source.code : undefined,
    details: source.details,
    message: typeof source.message === "string" ? source.message : undefined,
    requestId: typeof source.requestId === "string" ? source.requestId : undefined
  };
}

function uploadMarkdownFile(
  path: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<ImportMarkdownVersionResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    const token = readAuthToken();

    formData.set("file", file);
    request.open("POST", buildApiUrl(path));

    if (token) {
      request.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const responseBody = parseJsonResponse(request.responseText);

      if (request.status < 200 || request.status >= 300) {
        const payload = readErrorPayload(responseBody);

        reject(new ApiError({
          code: payload.code,
          details: payload.details,
          message: payload.message,
          requestId: payload.requestId ?? request.getResponseHeader("x-request-id"),
          status: request.status
        }));
        return;
      }

      resolve(responseBody as ImportMarkdownVersionResponse);
    };
    request.onerror = () => {
      reject(new Error("Markdown upload failed."));
    };
    request.onabort = () => {
      reject(new Error("Markdown upload was canceled."));
    };
    request.send(formData);
  });
}

export const versionApi = {
  listVersions(articleId: number, locale: ArticleLocale): Promise<ListVersionsResponse> {
    return httpClient.get<ListVersionsResponse>(`/admin/articles/${articleId}/${locale}/versions`);
  },
  listVersionSummaries(articleId: number, locale: ArticleLocale): Promise<ListVersionsResponse> {
    return httpClient.get<ListVersionsResponse>(`/admin/articles/${articleId}/${locale}/versions?content=summary`);
  },
  getVersion(articleId: number, locale: ArticleLocale, versionId: number): Promise<GetVersionResponse> {
    return httpClient.get<GetVersionResponse>(`/admin/articles/${articleId}/${locale}/versions/${versionId}`);
  },
  importMarkdownFile(
    articleId: number,
    locale: ArticleLocale,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ImportMarkdownVersionResponse> {
    return uploadMarkdownFile(`/admin/articles/${articleId}/${locale}/versions/import`, file, onProgress);
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
    const body: { allowedRoles?: string[]; publishedAt?: string | null; versionId: number } = { versionId };

    if (input.allowedRoles !== undefined) {
      body.allowedRoles = input.allowedRoles;
    }

    if (input.publishedAt !== undefined) {
      body.publishedAt = input.publishedAt;
    }

    return httpClient.post<PublishVersionResponse>(`/admin/articles/${articleId}/${locale}/publish`, body);
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
