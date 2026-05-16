import { NextResponse } from "next/server";
import { loginUser } from "@/features/auth/service";
import { shouldUseSecureCookies } from "@/lib/auth";
import { getSafeDeviceName } from "@/lib/device";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await loginUser(body, {
    deviceName: getSafeDeviceName(request.headers.get("user-agent")),
    loginIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    cookieSecure: shouldUseSecureCookies(request)
  });
  const status = result.ok || result.requiresSecondFactor ? 200 : 401;
  return NextResponse.json(result, { status });
}
