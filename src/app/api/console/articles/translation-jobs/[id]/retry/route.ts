import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getArticleTranslationJobReadiness, retryArticleTranslationJob } from "@/features/articles/translation-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const readiness = await getArticleTranslationJobReadiness();
    if (!readiness.ready) {
      return NextResponse.json({ ok: false, message: readiness.message }, { status: 503 });
    }

    const { id } = await context.params;
    const job = await retryArticleTranslationJob(user, id);
    return NextResponse.json({ ok: true, job });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "重试翻译任务失败。"
      },
      { status: 500 }
    );
  }
}
