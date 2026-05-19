import { NextResponse } from "next/server";
import { getSetupStatus } from "@/features/setup/service";
import { submitSetup } from "@/features/setup/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getSetupStatus();
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "请求数据不是有效 JSON。"
      },
      { status: 400 }
    );
  }

  try {
    const result = await submitSetup(payload, request);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "安装配置保存失败。"
      },
      { status: 500 }
    );
  }
}
