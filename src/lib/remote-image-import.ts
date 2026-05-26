import { db } from "@/lib/db";
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE } from "@/lib/constants";
import { saveUploadedImage } from "@/lib/upload";

export function isPrivateHost(hostname: string) {
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

function assertImageMimeType(mimeType: string) {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Unsupported image type.");
  }
}

async function fileFromBase64(src: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(src);
  if (!match) {
    throw new Error("Invalid base64 image.");
  }

  const mimeType = match[1].toLowerCase();
  assertImageMimeType(mimeType);

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > UPLOAD_MAX_SIZE) {
    throw new Error("Image is too large.");
  }

  return new File([buffer], `imported-${Date.now()}`, { type: mimeType });
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
  assertImageMimeType(contentType);

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

export function isImportableImageSource(src: string) {
  return /^https?:\/\//i.test(src) || /^data:image\//i.test(src);
}

export async function importImageSource(src: string, uploaderId: string) {
  const cleanSrc = src.trim();
  if (!cleanSrc) {
    throw new Error("Image URL is required.");
  }

  const file = cleanSrc.startsWith("data:") ? await fileFromBase64(cleanSrc) : await fileFromRemote(cleanSrc);
  const saved = await saveUploadedImage(file);
  return db.mediaAsset.create({
    data: {
      ...saved,
      uploaderId
    }
  });
}
