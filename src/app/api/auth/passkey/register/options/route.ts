import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { generatePasskeyRegistration } from "@/features/auth/passkey-service";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireUser();
    const options = await generatePasskeyRegistration(user);
    return NextResponse.json(options);
  } catch (error) {
    return apiError(error, {
      status: 400,
      code: "PASSKEY_REGISTER_OPTIONS_FAILED",
      fallback: "Failed to start passkey registration."
    });
  }
}
