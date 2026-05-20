import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canAccessConsole } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canAccessConsole(user)) {
    return NextResponse.json({ ok: false, message: "Permission denied." }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  console.error("[client-error]", {
    userId: user.id,
    source: typeof payload.source === "string" ? payload.source : "unknown",
    name: typeof payload.name === "string" ? payload.name : undefined,
    message: typeof payload.message === "string" ? payload.message : undefined,
    stack: typeof payload.stack === "string" ? payload.stack : undefined,
    componentStack: typeof payload.componentStack === "string" ? payload.componentStack : undefined
  });

  return NextResponse.json({ ok: true });
}
