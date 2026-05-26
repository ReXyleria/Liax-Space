import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { canManageArticles } from "@/lib/permissions";
import { importImageSource } from "@/lib/remote-image-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageArticles(user)) {
      return apiError(new Error("Permission denied."), { status: 403, code: "UPLOAD_FORBIDDEN" });
    }

    const body = (await request.json()) as { src?: unknown };
    const src = typeof body.src === "string" ? body.src.trim() : "";
    if (!src) {
      return apiError(new Error("Image URL is required."), { status: 400, code: "REMOTE_IMAGE_REQUIRED" });
    }

    if (src.startsWith("/") && !src.startsWith("/uploads/")) {
      return apiError(new Error("Relative image paths need manual upload or an attachment mapping."), {
        status: 400,
        code: "RELATIVE_IMAGE_UNSUPPORTED",
        exposeMessage: true
      });
    }

    const asset = await importImageSource(src, user.id);

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    return apiError(error, {
      status: 400,
      code: "REMOTE_IMAGE_IMPORT_FAILED",
      fallback: "Image import failed.",
      exposeMessage: true
    });
  }
}
