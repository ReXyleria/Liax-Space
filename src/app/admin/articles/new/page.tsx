import { ArticleEditorForm } from "@/components/forms/article-editor-form";
import type { PreviewSiteSettings } from "@/components/forms/article-preview-overlay";
import { getAllTags } from "@/features/articles/service";
import { listArticleViewerIdentities } from "@/features/identity/service";
import { getPreviewSiteSettings } from "@/features/settings/preview-site";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n";
import { canManageArticles } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const fallbackSite: PreviewSiteSettings = {
  title: "Liax-Space",
  subtitle: "",
  logo: "",
  copyright: `© ${new Date().getFullYear()} Liax-Space. All rights reserved.`,
  icp: "",
  icpUrl: "https://beian.miit.gov.cn/",
  police: "",
  policeUrl: "https://www.beian.gov.cn/portal/registerSystemInfo"
};

async function optionalWorkspaceData<T>(
  label: string,
  task: Promise<T>,
  fallback: T
): Promise<{ value: T; warning?: string }> {
  try {
    return { value: await task };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Optional article workspace dependency failed: ${label}`, error);
    return {
      value: fallback,
      warning: `${label} failed to load: ${message}`
    };
  }
}

export default async function NewArticlePage() {
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageArticles, "/admin/articles/new")
  ]);

  const [tagsResult, siteResult, identitiesResult] = await Promise.all([
    optionalWorkspaceData("Tags", getAllTags(), []),
    optionalWorkspaceData("Preview site settings", getPreviewSiteSettings(), fallbackSite),
    optionalWorkspaceData("Viewer identities", listArticleViewerIdentities(user), [])
  ]);
  const warnings = [tagsResult.warning, siteResult.warning, identitiesResult.warning].filter(
    (warning): warning is string => Boolean(warning)
  );

  return (
    <ArticleEditorForm
      locale={locale}
      tagOptions={tagsResult.value}
      site={siteResult.value}
      viewerIdentities={identitiesResult.value}
      warnings={warnings}
    />
  );
}
