import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageSettings } from "@/lib/permissions";
import { prewarmPublicCache } from "@/features/cache/prewarm";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || !canManageSettings(user)) {
    return NextResponse.json({ ok: false, message: "Permission denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Number.isFinite(Number(body?.limit)) ? Number(body.limit) : 50;
  const concurrency = Number.isFinite(Number(body?.concurrency)) ? Number(body.concurrency) : 4;
  const result = await prewarmPublicCache(Math.min(200, Math.max(1, Math.trunc(limit))), {
    concurrency: Math.min(8, Math.max(1, Math.trunc(concurrency)))
  });

  return NextResponse.json({ ok: true, ...result });
}
