import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { canManageArticles } from "@/lib/permissions";
import { listArticleVersions } from "@/features/articles/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await requireUser();
    if (!canManageArticles(user)) {
      return apiError(new Error("Permission denied."), {
        status: 403,
        code: "ARTICLE_VERSIONS_FORBIDDEN"
      });
    }
    const versions = await listArticleVersions(user, id);

    return NextResponse.json({
      ok: true,
      versions: versions.map((version) => ({
        id: version.id,
        version: version.version,
        title: version.title,
        slug: version.slug,
        summary: version.summary,
        cover: version.cover,
        contentJson: version.contentJson,
        contentHtml: version.contentHtml,
        status: version.status,
        visibility: version.visibility,
        tagNames: Array.isArray(version.tagNames) ? version.tagNames.map((tag) => String(tag)) : [],
        createdAt: version.createdAt.toISOString(),
        createdByName: version.createdBy.nickname
      }))
    });
  } catch (error) {
    return apiError(error, {
      status: 400,
      code: "ARTICLE_VERSIONS_FAILED",
      fallback: "Failed to load article versions."
    });
  }
}
