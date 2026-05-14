import { NextResponse } from "next/server";
import { sendRegisterCode } from "@/features/auth/service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await sendRegisterCode(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
