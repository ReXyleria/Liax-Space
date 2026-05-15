import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getUploadRoot } from "@/lib/runtime-paths";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

function isSafeUploadPath(segments: string[]) {
  return segments.length > 0 && segments.every((segment) =>
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\")
  );
}

function notFound() {
  return NextResponse.json({ ok: false, message: "Upload not found." }, { status: 404 });
}

export async function serveUploadedFile(requestedPath: string[]) {
  if (!isSafeUploadPath(requestedPath)) {
    return notFound();
  }

  const uploadRoot = path.resolve(getUploadRoot());
  const absolutePath = path.resolve(uploadRoot, ...requestedPath);
  if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    return notFound();
  }

  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return notFound();
    }

    const bytes = await readFile(absolutePath);
    const contentType = contentTypes[path.extname(absolutePath).toLowerCase()] || "application/octet-stream";

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        "Last-Modified": fileStat.mtime.toUTCString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[uploads-route] failed to serve upload", {
        path: requestedPath.join("/"),
        root: uploadRoot,
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
    return notFound();
  }
}
