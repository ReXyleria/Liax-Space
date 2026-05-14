import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-guard";
import { canManageBackups } from "@/lib/permissions";
import { getBackupFile } from "@/features/backup/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireAdminPermission(canManageBackups, `/admin/backup/${id}/download`);
  const { backup, bytes } = await getBackupFile(user, id);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": backup.filename.endsWith(".json")
        ? "application/json; charset=utf-8"
        : "application/gzip",
      "Content-Disposition": `attachment; filename="${backup.filename}"`
    }
  });
}
