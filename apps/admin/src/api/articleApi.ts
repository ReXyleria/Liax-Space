import { httpClient } from "./httpClient";

export type ArticleLocale = "zh-CN" | "en-US";

export type Article = {
  id: number;
  authorId: number;
  status: string;
  coverAttachmentId: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ArticleTranslation = {
  id: number;
  articleId: number;
  locale: ArticleLocale;
  title: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  summary: string | null;
  currentVersionId: number | null;
  publishedVersionId: number | null;
  currentHtmlPath: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  allowedRoles: string[];
};

export type ArticleDetail = {
  article: Article;
  translations: ArticleTranslation[];
};

export type ListArticlesResponse = {
  articles: ArticleDetail[];
};

export type CreateArticleRequest = {
  status?: string;
  coverAttachmentId?: number | null;
};

export type CreateArticleResponse = {
  article: Article;
};

export type UpdateArticleConfigRequest = {
  status?: string;
  coverAttachmentId?: number | null;
};

export type UpdateArticleResponse = {
  article: Article;
};

export type GetArticleResponse = ArticleDetail;

export type TranslationMetadataInput = {
  allowedRoles?: string[];
  locale: ArticleLocale;
  title: string;
  slug: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
};

export type UpdateTranslationMetadataInput = Omit<TranslationMetadataInput, "locale">;

export type TranslationResponse = {
  translation: ArticleTranslation;
};

export type ListArticlesQuery = {
  status?: string;
  limit?: number;
  offset?: number;
};

function buildQuery(input: ListArticlesQuery = {}): string {
  const params = new URLSearchParams();

  if (input.status) {
    params.set("status", input.status);
  }

  if (input.limit !== undefined) {
    params.set("limit", String(input.limit));
  }

  if (input.offset !== undefined) {
    params.set("offset", String(input.offset));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const articleApi = {
  createArticle(input: CreateArticleRequest = {}): Promise<CreateArticleResponse> {
    return httpClient.post<CreateArticleResponse>("/admin/articles", input);
  },
  createTranslation(articleId: number, input: TranslationMetadataInput): Promise<TranslationResponse> {
    return httpClient.post<TranslationResponse>(`/admin/articles/${articleId}/translations`, input);
  },
  getArticle(articleId: number): Promise<GetArticleResponse> {
    return httpClient.get<GetArticleResponse>(`/admin/articles/${articleId}`);
  },
  listArticles(input: ListArticlesQuery = {}): Promise<ListArticlesResponse> {
    return httpClient.get<ListArticlesResponse>(`/admin/articles${buildQuery(input)}`);
  },
  updateArticle(articleId: number, input: UpdateArticleConfigRequest): Promise<UpdateArticleResponse> {
    return httpClient.patch<UpdateArticleResponse>(`/admin/articles/${articleId}`, input);
  },
  updateTranslation(
    articleId: number,
    locale: ArticleLocale,
    input: UpdateTranslationMetadataInput
  ): Promise<TranslationResponse> {
    return httpClient.patch<TranslationResponse>(`/admin/articles/${articleId}/translations/${locale}`, input);
  }
};
