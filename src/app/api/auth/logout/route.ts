import { NextResponse } from "next/server";
import { logoutUser } from "@/features/auth/service";

export async function POST() {
  const result = await logoutUser();
  return NextResponse.json(result);
}
