import { ArticleStatus } from "@prisma/client";
import type { Locale } from "@/lib/i18n-messages";

const labels: Record<Locale, Record<ArticleStatus, string>> = {
  "zh-CN": {
    [ArticleStatus.DRAFT]: "草稿",
    [ArticleStatus.PUBLISHED]: "已发布",
    [ArticleStatus.ARCHIVED]: "已归档"
  },
  en: {
    [ArticleStatus.DRAFT]: "Draft",
    [ArticleStatus.PUBLISHED]: "Published",
    [ArticleStatus.ARCHIVED]: "Archived"
  }
};

export function articleStatusLabel(locale: Locale, status: ArticleStatus) {
  return labels[locale]?.[status] ?? status;
}
