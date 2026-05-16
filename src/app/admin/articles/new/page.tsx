import { ArticleEditorForm } from "@/components/forms/article-editor-form";
import type { PreviewSiteSettings } from "@/components/forms/article-preview-overlay";
import { getAllTags } from "@/features/articles/service";
import { getPreviewSiteSettings } from "@/features/settings/preview-site";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n";
import { canManageArticles } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const fallbackSite: PreviewSiteSettings = {
  title: "Liax-Space",
  subtitle: "",
  logo: "",
  copyright: `(c) ${new Date().getFullYear()} Liax-Space. All rights reserved.`,
  icp: "",
  icpUrl: "https://beian.miit.gov.cn/",
  police: "",
  policeUrl: "https://www.beian.gov.cn/portal/registerSystemInfo"
};

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause instanceof Error
        ? {
            name: error.cause.name,
            message: error.cause.message,
            stack: error.cause.stack
          }
        : error.cause
    };
  }

  return {
    name: typeof error,
    message: String(error)
  };
}

function isNextNavigationError(error: unknown) {
  const digest = typeof (error as { digest?: unknown })?.digest === "string"
    ? (error as { digest: string }).digest
    : "";

  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

async function optionalWorkspaceData<T>(
  label: string,
  task: Promise<T>,
  fallback: T
): Promise<{ value: T; warning?: string }> {
  try {
    return { value: await task };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Optional article workspace dependency failed: ${label}`, serializeError(error));
    return {
      value: fallback,
      warning: `${label} failed to load: ${message}`
    };
  }
}

export default async function NewArticlePage() {
  try {
    const [locale, user] = await Promise.all([
      getAdminLocale(),
      requireAdminPermission(canManageArticles, "/admin/articles/new")
    ]);

    const [tagsResult, siteResult] = await Promise.all([
      optionalWorkspaceData("Tags", getAllTags(), []),
      optionalWorkspaceData("Preview site settings", getPreviewSiteSettings(), fallbackSite)
    ]);
    const warnings = [tagsResult.warning, siteResult.warning].filter(
      (warning): warning is string => Boolean(warning)
    );

    return (
      <ArticleEditorForm
        locale={locale}
        tagOptions={tagsResult.value}
        site={siteResult.value}
        warnings={warnings}
      />
    );
  } catch (error) {
    if (!isNextNavigationError(error)) {
      console.error("[article-workspace] core load failed", serializeError(error));
    }
    throw error;
  }
}
