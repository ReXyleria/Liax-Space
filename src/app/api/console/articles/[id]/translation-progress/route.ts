import { NextRequest, NextResponse } from "next/server";
import { getArticleTranslationProgress } from "@/features/articles/translation-service";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const locale = request.nextUrl.searchParams.get("locale") ?? "en-US";
    const progress = await getArticleTranslationProgress(user, id, locale);

    return NextResponse.json({
      ok: true,
      progress
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to load translation progress."
      },
      { status: 500 }
    );
  }
}
