import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSafeDeviceName } from "@/lib/device";
import { verifyPasskeyRegistration } from "@/features/auth/passkey-service";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    await verifyPasskeyRegistration(user, body, getSafeDeviceName(request.headers.get("user-agent")));
    return NextResponse.json({ ok: true, message: "Passkey registered." });
  } catch (error) {
    return apiError(error, {
      status: 400,
      code: "PASSKEY_REGISTER_VERIFY_FAILED",
      fallback: "Failed to verify passkey registration."
    });
  }
}
