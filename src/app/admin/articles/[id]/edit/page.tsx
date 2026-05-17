import { notFound } from "next/navigation";
import { ArticleLanguageWorkspace } from "@/components/forms/article-language-workspace";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageArticles } from "@/lib/permissions";
import { getAdminArticle, getAllTags } from "@/features/articles/service";
import { listArticleTranslations } from "@/features/articles/translation-service";
import { getPreviewSiteSettings } from "@/features/settings/preview-site";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageArticles, `/admin/articles/${id}/edit`)
  ]);
  const [article, tagOptions, translations, site] = await Promise.all([
    getAdminArticle(user, id),
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
    tags: article.tags.flatMap((tag) => (tag?.name ? [{ name: tag.name }] : []))
  };

  return (
    <ArticleLanguageWorkspace
      locale={locale}
      article={articleFormValue}
      tagOptions={tagOptions}
      site={site}
      translations={translations.map((translation) => ({
        id: translation.id,
        locale: translation.locale,
        title: translation.title,
        summary: translation.summary,
        contentHtml: translation.contentHtml,
        contentJson: translation.contentJson,
        status: translation.status,
        error: translation.error,
        contentHash: translation.contentHash,
        updatedAtLabel: formatDate(translation.updatedAt)
      }))}
    />
  );
}
