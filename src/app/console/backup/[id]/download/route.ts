import { createReadStream } from "fs";
import { Readable } from "stream";
import { requireConsolePermission } from "@/lib/console-guard";
import { canManageBackups } from "@/lib/permissions";
import { getBackupFileDownload } from "@/features/backup/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDispositionFilename(filename: string) {
  const fallback = filename.replace(/[^\w.-]+/g, "_") || "backup.tar.gz";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireConsolePermission(canManageBackups, `/console/backup/${id}/download`);
  const { backup, filePath, sizeBytes } = await getBackupFileDownload(user, id);
  const stream = Readable.toWeb(createReadStream(filePath));

  return new Response(stream as BodyInit, {
    headers: {
      "Content-Type": backup.filename.endsWith(".json")
        ? "application/json; charset=utf-8"
        : "application/gzip",
      "Content-Length": String(sizeBytes),
      "Content-Disposition": contentDispositionFilename(backup.filename),
      "Cache-Control": "private, no-store"
    }
  });
}
