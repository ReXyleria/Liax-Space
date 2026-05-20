import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { canManageBackups } from "@/lib/permissions";
import { importBackupFile } from "@/features/backup/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageBackups(user)) {
      return apiError(new Error("权限不足。"), {
        status: 403,
        code: "BACKUP_UPLOAD_FORBIDDEN",
        fallback: "权限不足。"
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return apiError(new Error("请选择要上传的备份文件。"), {
        status: 400,
        code: "BACKUP_UPLOAD_FILE_MISSING",
        fallback: "请选择要上传的备份文件。"
      });
    }

    const backup = await importBackupFile(user, file.name, Buffer.from(await file.arrayBuffer()));
    revalidatePath("/console/backup");
    revalidatePath("/console/data/backups");

    return NextResponse.json({
      ok: true,
      message: "备份文件已上传到备份列表。",
      backup: {
        id: backup.id,
        filename: backup.filename,
        sizeBytes: backup.sizeBytes,
        reason: backup.reason
      }
    });
  } catch (error) {
    console.error("Backup upload failed", error);
    return apiError(error, {
      status: 400,
      code: "BACKUP_UPLOAD_FAILED",
      fallback: "上传备份失败。"
    });
  }
}
