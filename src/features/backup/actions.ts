"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createBackup,
  deleteBackup,
  restoreBackupFromId,
  syncBackupDirectory,
  updateBackupScheduleConfig
} from "@/features/backup/service";

export type BackupActionState = {
  ok: boolean;
  message: string;
  id?: string;
};

const ok = (message: string, id?: string): BackupActionState => ({ ok: true, message, id });
const fail = (error: unknown, fallback: string, id?: string): BackupActionState => ({
  ok: false,
  message: error instanceof Error ? error.message : fallback,
  id
});

function revalidateBackupPages() {
  revalidatePath("/console/backup");
  revalidatePath("/console/data/backups");
}

export async function createBackupAction(): Promise<BackupActionState> {
  try {
    const user = await requireUser();
    await createBackup(user, "manual");
    revalidateBackupPages();
    return ok("备份已创建。");
  } catch (error) {
    return fail(error, "创建备份失败。");
  }
}

export async function createBackupFormAction(): Promise<void> {
  const user = await requireUser();
  await createBackup(user, "manual");
  revalidateBackupPages();
}

export async function deleteBackupAction(
  _previousState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  const id = String(formData.get("id") ?? "");

  try {
    const user = await requireUser();
    await deleteBackup(user, id);
    revalidateBackupPages();
    return ok("备份已删除。", id);
  } catch (error) {
    return fail(error, "删除备份失败。", id);
  }
}

export async function restoreStoredBackupAction(
  _previousState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  const id = String(formData.get("id") ?? "");

  try {
    const user = await requireUser();

    if (!id) {
      throw new Error("备份记录不存在。");
    }

    await restoreBackupFromId(user, id);
    revalidateBackupPages();
    return ok("备份已还原。若当前会话被还原，请重新登录。", id);
  } catch (error) {
    return fail(error, "还原备份失败。", id);
  }
}

export async function syncBackupDirectoryAction(
  previousState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  void previousState;
  void formData;

  try {
    const user = await requireUser();
    const result = await syncBackupDirectory(user);
    revalidateBackupPages();
    return ok(`备份目录已刷新，新增 ${result.imported} 个备份${result.skipped ? `，跳过 ${result.skipped} 个无效文件` : ""}。`);
  } catch (error) {
    return fail(error, "刷新备份目录失败。");
  }
}

export async function updateBackupScheduleAction(
  _previousState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  try {
    const user = await requireUser();
    await updateBackupScheduleConfig(user, formData);
    revalidateBackupPages();
    return ok("备份计划已保存。");
  } catch (error) {
    return fail(error, "保存备份计划失败。");
  }
}
