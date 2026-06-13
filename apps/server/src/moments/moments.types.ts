import type { ArticleLocale } from "../articles/articles.types.js";

export type MomentStatus = "draft" | "published";

export type Moment = {
  id: number;
  authorId: number | null;
  locale: ArticleLocale;
  content: string;
  status: MomentStatus;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  deletedAt: Date | null;
};

export type CreateMomentInput = {
  authorId: number;
  locale: ArticleLocale;
  content: string;
  status?: MomentStatus;
};

export type UpdateMomentInput = {
  id: number;
  locale?: ArticleLocale;
  content?: string;
  status?: MomentStatus;
  publishedAt?: Date | null;
};

export type ListMomentsInput = {
  locale?: ArticleLocale;
  status?: MomentStatus;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
};
