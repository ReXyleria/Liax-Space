import { NextResponse } from "next/server";
import { sendPendingLoginEmailCode } from "@/features/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken : "";

  if (!pendingToken) {
    return NextResponse.json({ ok: false, message: "Second-factor session is missing." }, { status: 400 });
  }

  const result = await sendPendingLoginEmailCode(pendingToken);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
