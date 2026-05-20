"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createBackup,
  deleteBackup,
  restoreBackupFromId,
  updateBackupScheduleConfig
} from "@/features/backup/service";

export type BackupActionState = {
  ok: boolean;
  message: string;
};

const ok = (message: string): BackupActionState => ({ ok: true, message });
const fail = (error: unknown, fallback: string): BackupActionState => ({
  ok: false,
  message: error instanceof Error ? error.message : fallback
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
  try {
    const user = await requireUser();
    await deleteBackup(user, String(formData.get("id") ?? ""));
    revalidateBackupPages();
    return ok("备份已删除。");
  } catch (error) {
    return fail(error, "删除备份失败。");
  }
}

export async function restoreStoredBackupAction(
  _previousState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  try {
    const user = await requireUser();
    const id = String(formData.get("id") ?? "");

    if (!id) {
      throw new Error("备份记录不存在。");
    }

    await restoreBackupFromId(user, id);
    revalidateBackupPages();
    return ok("备份已还原。若当前会话被还原，请重新登录。");
  } catch (error) {
    return fail(error, "还原备份失败。");
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
