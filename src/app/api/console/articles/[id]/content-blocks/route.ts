import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getConsoleArticleContentBlocks } from "@/features/articles/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await requireUser();
  const after = Number(request.nextUrl.searchParams.get("after") ?? "-1");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "2");
  const locale = request.nextUrl.searchParams.get("locale") ?? "zh-CN";
  const result = await getConsoleArticleContentBlocks(user, {
    articleId: id,
    locale,
    after,
    limit
  });

  if (result.error) {
    return NextResponse.json({ ok: false, message: result.error, blocks: [] }, { status: 404 });
  }

  return NextResponse.json({ ok: true, blocks: result.blocks });
}
