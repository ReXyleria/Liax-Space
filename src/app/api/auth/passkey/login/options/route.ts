import { NextResponse } from "next/server";
import { generatePasskeyAuthentication } from "@/features/auth/passkey-service";
import { getPendingLogin } from "@/features/auth/service";
import { apiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken : "";

    if (pendingToken) {
      const pending = await getPendingLogin(pendingToken);
      if (!pending) {
        return apiError(new Error("Pending login expired."), {
          status: 400,
          code: "PENDING_LOGIN_EXPIRED",
          fallback: "Second-factor session expired."
        });
      }

      const options = await generatePasskeyAuthentication({ userId: pending.userId });
      return NextResponse.json(options);
    }

    const account = typeof body.account === "string" ? body.account : "";
    const options = await generatePasskeyAuthentication({ account: account || undefined });
    return NextResponse.json(options);
  } catch (error) {
    return apiError(error, {
      status: 400,
      code: "PASSKEY_LOGIN_OPTIONS_FAILED",
      fallback: "Failed to start passkey login."
    });
  }
}
