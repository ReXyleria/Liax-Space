import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageArticles, canManageMoments, canManageSettings } from "@/lib/permissions";
import { saveUploadedImage } from "@/lib/upload";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    if (!canManageArticles(user) && !canManageMoments(user) && !canManageSettings(user)) {
      return apiError(new Error("Permission denied."), {
        status: 403,
        code: "UPLOAD_FORBIDDEN",
        fallback: "Permission denied."
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError(new Error("No file uploaded."), {
        status: 400,
        code: "UPLOAD_FILE_MISSING",
        fallback: "No file uploaded."
      });
    }

    const saved = await saveUploadedImage(file);
    const asset = await db.mediaAsset.create({
      data: {
        ...saved,
        uploaderId: user.id
      }
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Upload failed", error);
    }
    return apiError(error, {
      status: 400,
      code: "UPLOAD_FAILED",
      fallback: "Upload failed.",
      exposeMessage: false
    });
  }
}
