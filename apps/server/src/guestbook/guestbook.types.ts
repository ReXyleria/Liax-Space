import type { ArticleLocale } from "../articles/articles.types.js";

export type GuestbookEntry = {
  id: number;
  locale: ArticleLocale;
  authorName: string;
  email: string | null;
  content: string;
  notifyOnly: boolean;
  isPublic: boolean;
  createdAt: Date;
  deletedAt: Date | null;
};

export type CreateGuestbookEntryInput = {
  locale: ArticleLocale;
  authorName: string;
  email: string | null;
  content: string;
  notifyOnly: boolean;
  isPublic: boolean;
};

export type ListPublicGuestbookEntriesInput = {
  locale: ArticleLocale;
  limit?: number;
  offset?: number;
};

export type ListGuestbookEntriesInput = {
  locale?: ArticleLocale;
  status?: "all" | "public" | "private" | "hidden";
  limit?: number;
  offset?: number;
};

export type UpdateGuestbookEntryInput = {
  id: number;
  isPublic?: boolean;
  notifyOnly?: boolean;
};
