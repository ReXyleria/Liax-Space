import { NextResponse } from "next/server";
import { getSafeDeviceName } from "@/lib/device";
import { verifyLoginSecondFactor } from "@/features/auth/service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await verifyLoginSecondFactor(body, {
    deviceName: getSafeDeviceName(request.headers.get("user-agent")),
    loginIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}
