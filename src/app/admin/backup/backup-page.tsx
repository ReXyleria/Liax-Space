import { BackupPanel, type BackupPanelText } from "@/components/admin/backup-panel";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createBackupFormAction } from "@/features/backup/actions";
import { getBackupScheduleConfig, listBackups } from "@/features/backup/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale, t } from "@/lib/i18n";
import { canManageBackups } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

function formatSize(size: number) {
  if (size > 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function backupText(locale: Awaited<ReturnType<typeof getAdminLocale>>): BackupPanelText {
  return {
    scheduledBackups: t(locale, "scheduledBackups"),
    scheduledBackupsDescription: t(locale, "scheduledBackupsDescription"),
    enableScheduledBackup: t(locale, "enableScheduledBackup"),
    enableScheduledBackupDescription: t(locale, "enableScheduledBackupDescription"),
    frequency: t(locale, "frequency"),
    daily: t(locale, "daily"),
    weekly: t(locale, "weekly"),
    monthly: t(locale, "monthly"),
    saveSchedule: t(locale, "saveSchedule"),
    saving: t(locale, "saving"),
    restoreFromUpload: t(locale, "restoreFromUpload"),
    restoreFromUploadDescription: t(locale, "restoreFromUploadDescription"),
    chooseBackupFile: t(locale, "chooseBackupFile"),
    backupFileSupport: t(locale, "backupFileSupport"),
    browse: t(locale, "browse"),
    restore: t(locale, "restore"),
    restoring: t(locale, "restoring"),
    backupList: t(locale, "backupList"),
    noBackups: t(locale, "noBackups"),
    noBackupsDescription: t(locale, "noBackupsDescription"),
    download: t(locale, "download"),
    delete: t(locale, "delete"),
    deleting: t(locale, "deleting"),
    cancel: t(locale, "cancel"),
    restoreWarning: t(locale, "restoreWarning"),
    restoreWarningBody: t(locale, "restoreWarningBody"),
    typeRestoreToConfirm: t(locale, "typeRestoreToConfirm"),
    confirmRestore: t(locale, "confirmRestore"),
    manual: t(locale, "manual")
  };
}

export async function BackupPageContent({ path }: { path: string }) {
  const [user, locale] = await Promise.all([
    requireAdminPermission(canManageBackups, path),
    getAdminLocale()
  ]);
  const [{ backups, error }, scheduleResult] = await Promise.all([
    listBackups(user),
    getBackupScheduleConfig(user)
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t(locale, "adminData")}
        title={t(locale, "adminBackup")}
        description={t(locale, "adminBackupDescription")}
        action={
          <form action={createBackupFormAction}>
            <Button type="submit">{t(locale, "createBackup")}</Button>
          </form>
        }
      />
      {error ?? scheduleResult.error ? <Card className="p-5 text-destructive">{error ?? scheduleResult.error}</Card> : null}
      <BackupPanel
        text={backupText(locale)}
        schedule={scheduleResult.config}
        backups={backups.map((backup) => ({
          id: backup.id,
          filename: backup.filename,
          sizeLabel: formatSize(backup.sizeBytes),
          status: backup.status,
          reason: backup.reason,
          error: backup.error,
          createdAtLabel: formatDate(backup.createdAt)
        }))}
      />
    </div>
  );
}
