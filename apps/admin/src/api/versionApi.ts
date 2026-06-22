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
  version: ArticleVersionSummary;
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

export type UnpublishVersionResponse = {
  translation: ArticleTranslation;
};

export type PublishVersionRequest = {
  allowedRoles?: string[];
  publishedAt?: string | null;
};

export type MarkdownLoadProgress = {
  content: string;
  done: boolean;
  loadedLength: number;
  totalLength: number;
};

export type MarkdownLoadOptions = {
  onProgress?: (progress: MarkdownLoadProgress) => void;
};

const initialMarkdownChunkSize = 256 * 1024;
const markdownChunkSize = 2 * 1024 * 1024;

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

function appendMarkdownChunkQuery(path: string, offset: number, limit: number): string {
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}offset=${offset}&limit=${limit}`;
}

async function fetchMarkdownText(path: string, options: MarkdownLoadOptions = {}): Promise<string> {
  const token = readAuthToken();
  const headers = new Headers();
  let markdown = "";
  let offset = 0;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  while (true) {
    const limit = offset === 0 ? initialMarkdownChunkSize : markdownChunkSize;
    const response = await fetch(buildApiUrl(appendMarkdownChunkQuery(path, offset, limit)), { headers });
    const responseText = await response.text();

    if (!response.ok) {
      const payload = readErrorPayload(parseJsonResponse(responseText));

      throw new ApiError({
        code: payload.code,
        details: payload.details,
        message: payload.message,
        requestId: payload.requestId ?? response.headers.get("x-request-id"),
        status: response.status
      });
    }

    markdown += responseText;

    const totalLength = Number(response.headers.get("x-markdown-total-length") ?? responseText.length);
    const nextOffset = Number(response.headers.get("x-markdown-next-offset") ?? offset + responseText.length);

    if (!Number.isFinite(totalLength) || !Number.isFinite(nextOffset)) {
      throw new Error("Markdown chunk response is missing progress metadata.");
    }

    const done = totalLength === 0 || nextOffset >= totalLength;

    options.onProgress?.({
      content: markdown,
      done,
      loadedLength: nextOffset,
      totalLength
    });

    if (done) {
      return markdown;
    }

    if (nextOffset <= offset) {
      throw new Error("Markdown chunk response did not advance.");
    }

    offset = nextOffset;
  }
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
  getVersionMarkdown(
    articleId: number,
    locale: ArticleLocale,
    versionId: number,
    options?: MarkdownLoadOptions
  ): Promise<string> {
    return fetchMarkdownText(`/admin/articles/${articleId}/${locale}/versions/${versionId}/markdown`, options);
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
  unpublishVersion(articleId: number, locale: ArticleLocale): Promise<UnpublishVersionResponse> {
    return httpClient.post<UnpublishVersionResponse>(`/admin/articles/${articleId}/${locale}/unpublish`, {});
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
