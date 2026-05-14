import { ArticleEditorForm } from "@/components/forms/article-editor-form";
import { getAllTags } from "@/features/articles/service";
import { listArticleViewerIdentities } from "@/features/identity/service";
import { getPreviewSiteSettings } from "@/features/settings/preview-site";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n";
import { canManageArticles } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageArticles, "/admin/articles/new")
  ]);
  const [tagOptions, site, viewerIdentities] = await Promise.all([
    getAllTags(),
    getPreviewSiteSettings(),
    listArticleViewerIdentities(user)
  ]);

  return <ArticleEditorForm locale={locale} tagOptions={tagOptions} site={site} viewerIdentities={viewerIdentities} />;
}
