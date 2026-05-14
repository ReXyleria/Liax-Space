import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE } from "@/lib/constants";
import { canManageArticles } from "@/lib/permissions";
import { saveUploadedImage } from "@/lib/upload";

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

async function fileFromBase64(src: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(src);
  if (!match) {
    throw new Error("Invalid base64 image.");
  }

  const mimeType = match[1];
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Unsupported image type.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > UPLOAD_MAX_SIZE) {
    throw new Error("Image is too large.");
  }

  return new File([buffer], `pasted-${Date.now()}`, { type: mimeType });
}

async function fileFromRemote(src: string) {
  const url = new URL(src);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) image URLs can be imported.");
  }

  if (isPrivateHost(url.hostname)) {
    throw new Error("Private or local network image URLs are blocked.");
  }

  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Image request failed with ${response.status}.`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_TYPES.includes(contentType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Remote URL is not a supported image.");
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > UPLOAD_MAX_SIZE) {
    throw new Error("Remote image is too large.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > UPLOAD_MAX_SIZE) {
    throw new Error("Remote image is too large.");
  }

  return new File([buffer], url.pathname.split("/").pop() || `remote-${Date.now()}`, { type: contentType });
}

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

    const file = src.startsWith("data:") ? await fileFromBase64(src) : await fileFromRemote(src);
    const saved = await saveUploadedImage(file);
    const asset = await db.mediaAsset.create({
      data: {
        ...saved,
        uploaderId: user.id
      }
    });

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
