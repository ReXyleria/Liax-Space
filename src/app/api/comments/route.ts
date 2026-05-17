import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createComment } from "@/features/comments/service";
import { apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { getSafeDeviceName } from "@/lib/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    await createComment(user, {
      ...body,
      deviceName: getSafeDeviceName(request.headers.get("user-agent"))
    });
    return NextResponse.json({ ok: true, message: "Comment submitted." });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error, {
        status: 400,
        code: "COMMENT_VALIDATION_FAILED",
        fallback: "Please check the comment content.",
        fieldErrors: error.flatten().fieldErrors,
        exposeMessage: false
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to create comment", error);
    }

    return apiError(error, {
      status: 400,
      code: "COMMENT_CREATE_FAILED",
      fallback: "Failed to submit comment."
    });
  }
}
