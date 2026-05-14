import { NextResponse } from "next/server";
import { getSafeDeviceName } from "@/lib/device";
import { verifyPasskeyAuthentication } from "@/features/auth/passkey-service";
import { createTrustedDevice } from "@/lib/auth";
import { clearPendingLogin, getPendingLogin } from "@/features/auth/service";
import { apiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken : "";
    const trustDevice = Boolean(body.trustDevice);
    const pending = pendingToken ? await getPendingLogin(pendingToken) : null;

    if (pendingToken && !pending) {
      return apiError(new Error("Pending login expired."), {
        status: 400,
        code: "PENDING_LOGIN_EXPIRED",
        fallback: "Second-factor session expired."
      });
    }

    const result = await verifyPasskeyAuthentication(body.response, {
      callbackUrl: typeof body.callbackUrl === "string" ? body.callbackUrl : undefined,
      deviceName: getSafeDeviceName(request.headers.get("user-agent")),
      loginIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
      expectedUserId: pending?.userId,
      allowUnboundChallenge: !pendingToken
    });

    if (result.ok && pending && trustDevice) {
      await createTrustedDevice(pending.userId, getSafeDeviceName(request.headers.get("user-agent")));
    }

    if (pendingToken) {
      await clearPendingLogin(pendingToken);
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, {
      status: 401,
      code: "PASSKEY_LOGIN_VERIFY_FAILED",
      fallback: "Failed to verify passkey login."
    });
  }
}
