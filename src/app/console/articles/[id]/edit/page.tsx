import { notFound } from "next/navigation";
import { ArticleLanguageWorkspace } from "@/components/forms/article-language-workspace";
import { requireConsolePermission } from "@/lib/console-guard";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageArticles } from "@/lib/permissions";
import { getConsoleArticle, getAllTags } from "@/features/articles/service";
import { listArticleTranslations } from "@/features/articles/translation-service";
import { getPreviewSiteSettings } from "@/features/settings/preview-site";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageArticles, `/console/articles/${id}/edit`)
  ]);
  const [article, tagOptions, contents, site] = await Promise.all([
    getConsoleArticle(user, id),
    getAllTags(),
    listArticleTranslations(user, id),
    getPreviewSiteSettings()
  ]);

  if (!article) {
    notFound();
  }

  const articleFormValue = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    cover: article.cover,
    contentJson: article.contentJson,
    contentHtml: article.contentHtml,
    status: article.status,
    publishedAt: article.publishedAt ?? null,
    visibility: article.visibility,
    allowComments: article.allowComments,
    pinned: article.pinned,
    featured: article.featured,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    sourceLocale: article.sourceLocale,
    tags: article.tags.flatMap((tag) => (tag?.name ? [{ name: tag.name }] : []))
  };

  return (
    <ArticleLanguageWorkspace
      locale={locale}
      article={articleFormValue}
      tagOptions={tagOptions}
      site={site}
      contents={contents.map((content) => ({
        id: content.id,
        locale: content.locale.toLowerCase().startsWith("en") ? "en-US" : "zh-CN",
        title: content.title,
        summary: content.summary,
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
        contentHtml: content.contentHtml,
        contentJson: content.contentJson,
        contentStatus: content.contentStatus,
        error: content.error,
        contentHash: content.contentHash,
        updatedAtLabel: content.updatedAt.toISOString()
      }))}
    />
  );
}
