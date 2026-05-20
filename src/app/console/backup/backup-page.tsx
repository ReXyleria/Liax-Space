import { BackupPanel, type BackupPanelText } from "@/components/console/backup-panel";
import { ConsolePageHeader } from "@/components/console/console-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createBackupFormAction } from "@/features/backup/actions";
import { getBackupScheduleConfig, listBackups } from "@/features/backup/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageBackups } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

function formatSize(size: number) {
  if (size > 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function backupText(locale: Awaited<ReturnType<typeof getConsoleLocale>>): BackupPanelText {
  return {
    scheduledBackups: t(locale, "scheduledBackups"),
    scheduledBackupsDescription: t(locale, "scheduledBackupsDescription"),
    enableScheduledBackup: t(locale, "enableScheduledBackup"),
    enableScheduledBackupDescription: t(locale, "enableScheduledBackupDescription"),
    frequency: t(locale, "frequency"),
    retention: t(locale, "backupRetention"),
    retentionDescription: t(locale, "backupRetentionDescription"),
    retention1Day: t(locale, "backupRetention1Day"),
    retention3Days: t(locale, "backupRetention3Days"),
    retention5Days: t(locale, "backupRetention5Days"),
    retention1Week: t(locale, "backupRetention1Week"),
    retention1Month: t(locale, "backupRetention1Month"),
    daily: t(locale, "daily"),
    weekly: t(locale, "weekly"),
    monthly: t(locale, "monthly"),
    saveSchedule: t(locale, "saveSchedule"),
    saving: t(locale, "saving"),
    uploadBackupFile: t(locale, "uploadBackupFile"),
    uploadBackupDescription: t(locale, "uploadBackupDescription"),
    chooseBackupFile: t(locale, "chooseBackupFile"),
    backupFileSupport: t(locale, "backupFileSupport"),
    browse: t(locale, "browse"),
    uploadBackup: t(locale, "uploadBackup"),
    uploadingBackup: t(locale, "uploadingBackup"),
    uploadProgressReady: t(locale, "uploadProgressReady"),
    uploadProgressRunning: t(locale, "uploadProgressRunning"),
    uploadProgressSuccess: t(locale, "uploadProgressSuccess"),
    uploadProgressFailed: t(locale, "uploadProgressFailed"),
    retryUpload: t(locale, "retryUpload"),
    restore: t(locale, "restore"),
    restoring: t(locale, "restoring"),
    backupList: t(locale, "backupList"),
    refreshBackups: t(locale, "refreshBackups"),
    noBackups: t(locale, "noBackups"),
    noBackupsDescription: t(locale, "noBackupsDescription"),
    download: t(locale, "download"),
    delete: t(locale, "delete"),
    deleting: t(locale, "deleting"),
    cancel: t(locale, "cancel"),
    close: t(locale, "close"),
    restoreWarning: t(locale, "restoreWarning"),
    restoreWarningBody: t(locale, "restoreWarningBody"),
    confirmRestore: t(locale, "confirmRestore"),
    restoreProgressReady: t(locale, "restoreProgressReady"),
    restoreProgressRunning: t(locale, "restoreProgressRunning"),
    restoreProgressSuccess: t(locale, "restoreProgressSuccess"),
    restoreProgressFailed: t(locale, "restoreProgressFailed"),
    restoreSelectedBackup: t(locale, "restoreSelectedBackup"),
    retryRestore: t(locale, "retryRestore"),
    deleteBackupDescription: t(locale, "deleteBackupDescription"),
    manual: t(locale, "manual")
  };
}

export async function BackupPageContent({ path }: { path: string }) {
  const [user, locale] = await Promise.all([
    requireConsolePermission(canManageBackups, path),
    getConsoleLocale()
  ]);
  const [{ backups, error }, scheduleResult] = await Promise.all([
    listBackups(user),
    getBackupScheduleConfig(user)
  ]);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t(locale, "consoleData")}
        title={t(locale, "consoleBackup")}
        description={t(locale, "consoleBackupDescription")}
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
