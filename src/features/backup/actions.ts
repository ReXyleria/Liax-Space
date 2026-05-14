"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createBackup,
  deleteBackup,
  restoreBackup,
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
  revalidatePath("/admin/backup");
  revalidatePath("/admin/data/backups");
}

export async function createBackupAction(): Promise<BackupActionState> {
  try {
    const user = await requireUser();
    await createBackup(user, "manual");
    revalidateBackupPages();
    return ok("Backup created.");
  } catch (error) {
    return fail(error, "Failed to create backup.");
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
    return ok("Backup deleted.");
  } catch (error) {
    return fail(error, "Failed to delete backup.");
  }
}

export async function restoreBackupAction(
  _previousState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  try {
    const user = await requireUser();
    const confirm = String(formData.get("confirm") ?? "");
    const file = formData.get("backupFile");

    if (confirm !== "RESTORE") {
      throw new Error("Type RESTORE to confirm.");
    }

    if (!(file instanceof File)) {
      throw new Error("Select a backup file.");
    }

    await restoreBackup(user, Buffer.from(await file.arrayBuffer()));
    revalidateBackupPages();
    return ok("Backup restored. Sign in again if your current session was restored.");
  } catch (error) {
    return fail(error, "Failed to restore backup.");
  }
}

export async function restoreStoredBackupAction(
  _previousState: BackupActionState,
  formData: FormData
): Promise<BackupActionState> {
  try {
    const user = await requireUser();
    const id = String(formData.get("id") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (confirm !== "RESTORE") {
      throw new Error("Type RESTORE to confirm the restore.");
    }

    await restoreBackupFromId(user, id);
    revalidateBackupPages();
    return ok("Backup restored. Sign in again if your current session was restored.");
  } catch (error) {
    return fail(error, "Failed to restore backup.");
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
    return ok("Backup schedule saved.");
  } catch (error) {
    return fail(error, "Failed to save backup schedule.");
  }
}
