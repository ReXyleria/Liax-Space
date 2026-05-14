import { NextResponse } from "next/server";
import { clearPendingLogin } from "@/features/auth/service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken : "";

  if (pendingToken) {
    await clearPendingLogin(pendingToken);
  }

  return NextResponse.json({ ok: true, message: "Pending login cleared." });
}
