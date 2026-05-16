import { NextResponse } from "next/server";
import { recordVisit } from "@/features/analytics/visit-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    await recordVisit(request, body);
  } catch (error) {
    console.error("[analytics] failed to record visit", error);
  }

  return NextResponse.json({ ok: true });
}
