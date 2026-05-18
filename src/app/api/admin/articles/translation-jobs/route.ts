import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  enqueueArticleTranslationJobs,
  ensureArticleTranslationJobWorker,
  listLatestArticleTranslationJobs
} from "@/features/articles/translation-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseArticleIds(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const articleIds = parseArticleIds(request.nextUrl.searchParams.get("articleIds"));
    ensureArticleTranslationJobWorker();
    const jobs = await listLatestArticleTranslationJobs(user, articleIds);
    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to load translation jobs."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const jobs = await enqueueArticleTranslationJobs(user, {
      articleIds: body.articleIds,
      locale: body.locale
    });
    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to enqueue translation jobs."
      },
      { status: 500 }
    );
  }
}
