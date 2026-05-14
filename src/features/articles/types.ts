import type { ArticleStatus, ContentVisibility } from "@prisma/client";

export type ArticleListItem = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover: string | null;
  status: ArticleStatus;
  visibility: ContentVisibility;
  viewCount: number;
  featured: boolean;
  pinned: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  tags: Array<{ name: string; slug: string; color: string | null }>;
  author: { nickname: string };
};
