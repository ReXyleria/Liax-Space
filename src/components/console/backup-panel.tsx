"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileArchive, Loader2, RefreshCw, UploadCloud, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import {
  deleteBackupAction,
  restoreStoredBackupAction,
  syncBackupDirectoryAction,
  updateBackupScheduleAction,
  type BackupActionState
} from "@/features/backup/actions";

export type BackupPanelText = {
  scheduledBackups: string;
  scheduledBackupsDescription: string;
  enableScheduledBackup: string;
  enableScheduledBackupDescription: string;
  frequency: string;
  retention: string;
  retentionDescription: string;
  retention1Day: string;
  retention3Days: string;
  retention5Days: string;
  retention1Week: string;
  retention1Month: string;
  daily: string;
  weekly: string;
  monthly: string;
  saveSchedule: string;
  saving: string;
  uploadBackupFile: string;
  uploadBackupDescription: string;
  chooseBackupFile: string;
  backupFileSupport: string;
  browse: string;
  uploadBackup: string;
  uploadingBackup: string;
  uploadProgressReady: string;
  uploadProgressRunning: string;
  uploadProgressSuccess: string;
  uploadProgressFailed: string;
  retryUpload: string;
  restore: string;
  restoring: string;
  backupList: string;
  refreshBackups: string;
  noBackups: string;
  noBackupsDescription: string;
  download: string;
  delete: string;
  deleting: string;
  cancel: string;
  close: string;
  restoreWarning: string;
  restoreWarningBody: string;
  confirmRestore: string;
  restoreProgressReady: string;
  restoreProgressRunning: string;
  restoreProgressSuccess: string;
  restoreProgressFailed: string;
  restoreSelectedBackup: string;
  retryRestore: string;
  deleteBackupDescription: string;
  manual: string;
};

type BackupItem = {
  id: string;
  filename: string;
  sizeLabel: string;
  status: string;
  reason: string | null;
  error: string | null;
  createdAtLabel: string;
};

type BackupSchedule = {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  retentionDays: 1 | 3 | 5 | 7 | 30;
};

const initialState: BackupActionState = { ok: false, message: "" };

type UploadState = {
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  filename: string;
  message: string;
};

const initialUploadState: UploadState = {
  status: "idle",
  progress: 0,
  filename: "",
  message: ""
};

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function StateMessage({ state }: { state: BackupActionState }) {
  if (!state.message) {
    return null;
  }

  return <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>;
}

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((current, [key, value]) => current.replaceAll(`{${key}}`, value), template);
}

function RestoreProgressDialog({
  open,
  title,
  description,
  itemLabel,
  state,
  pending,
  onOpenChange,
  onConfirm,
  text
}: {
  open: boolean;
  title: string;
  description: string;
  itemLabel: string;
  state: BackupActionState;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  text: BackupPanelText;
}) {
  const hasResult = Boolean(state.message);
  const isSuccess = hasResult && state.ok;
  const isError = hasResult && !state.ok;
  const progress = pending ? 68 : isSuccess ? 100 : isError ? 100 : 14;
  const statusText = pending
    ? text.restoreProgressRunning
    : isSuccess
      ? text.restoreProgressSuccess
      : isError
        ? text.restoreProgressFailed
        : text.restoreProgressReady;

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      closeLabel={text.close}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && pending) {
          return;
        }
        onOpenChange(nextOpen);
      }}
      className="max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            {isSuccess ? text.close : text.cancel}
          </Button>
          {isError ? (
            <Button type="button" variant="danger" disabled={pending} onClick={onConfirm}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pending ? text.restoring : text.retryRestore}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{text.restoreWarning}</p>
          <p className="mt-1 truncate text-sm font-medium">{itemLabel}</p>
        </div>
        <div className="flex items-start gap-3">
          <span
            className={
              isSuccess
                ? "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-600"
                : isError
                  ? "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive"
                  : "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
            }
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isError ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <FileArchive className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-medium">{statusText}</p>
            <p className={isError ? "mt-1 text-sm text-destructive" : "mt-1 text-sm text-muted-foreground"}>
              {hasResult && !pending ? state.message : text.restoreWarningBody}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={isError ? "h-full bg-destructive transition-all duration-500" : "h-full bg-primary transition-all duration-500"}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-muted-foreground">{progress}%</p>
        </div>
      </div>
    </Dialog>
  );
}

function BackupUploadDialog({
  open,
  state,
  onOpenChange,
  onRetry,
  text
}: {
  open: boolean;
  state: UploadState;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  text: BackupPanelText;
}) {
  const isUploading = state.status === "uploading";
  const isSuccess = state.status === "success";
  const isError = state.status === "error";
  const statusText = isUploading
    ? text.uploadProgressRunning
    : isSuccess
      ? text.uploadProgressSuccess
      : isError
        ? text.uploadProgressFailed
        : text.uploadProgressReady;
  const progress = Math.max(0, Math.min(100, state.progress));

  return (
    <Dialog
      open={open}
      title={text.uploadBackupFile}
      description={statusText}
      closeLabel={text.close}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isUploading) {
          return;
        }
        onOpenChange(nextOpen);
      }}
      className="max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={isUploading} onClick={() => onOpenChange(false)}>
            {isSuccess ? text.close : text.cancel}
          </Button>
          {isError ? (
            <Button type="button" disabled={isUploading} onClick={onRetry}>
              {text.retryUpload}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span
            className={
              isSuccess
                ? "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-600"
                : isError
                  ? "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive"
                  : "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
            }
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isError ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{state.filename || text.chooseBackupFile}</p>
            <p className={isError ? "mt-1 text-sm text-destructive" : "mt-1 text-sm text-muted-foreground"}>
              {state.message || statusText}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={isError ? "h-full bg-destructive transition-all duration-500" : "h-full bg-primary transition-all duration-500"}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-muted-foreground">{progress}%</p>
        </div>
      </div>
    </Dialog>
  );
}

function ScheduleSection({
  schedule,
  state,
  action,
  pending,
  text
}: {
  schedule: BackupSchedule;
  state: BackupActionState;
  action: (formData: FormData) => void;
  pending: boolean;
  text: BackupPanelText;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-xl font-semibold">{text.scheduledBackups}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text.scheduledBackupsDescription}</p>
      <form action={action} className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
        <ThemedCheckbox
          name="enabled"
          value="true"
          label={text.enableScheduledBackup}
          description={text.enableScheduledBackupDescription}
          defaultChecked={schedule.enabled}
          className="md:min-h-10"
        />
        <label className="space-y-2 text-sm">
          <span className="font-medium">{text.frequency}</span>
          <Select
            name="frequency"
            defaultValue={schedule.frequency}
            options={[
              { value: "daily", label: text.daily },
              { value: "weekly", label: text.weekly },
              { value: "monthly", label: text.monthly }
            ]}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">{text.retention}</span>
          <Select
            name="retentionDays"
            defaultValue={String(schedule.retentionDays)}
            options={[
              { value: "1", label: text.retention1Day },
              { value: "3", label: text.retention3Days },
              { value: "5", label: text.retention5Days },
              { value: "7", label: text.retention1Week },
              { value: "30", label: text.retention1Month }
            ]}
          />
          <p className="text-xs text-muted-foreground">{text.retentionDescription}</p>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? text.saving : text.saveSchedule}
        </Button>
      </form>
      <div className="mt-3">
        <StateMessage state={state} />
      </div>
    </section>
  );
}

function UploadBackupSection({ text }: { text: BackupPanelText }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>(initialUploadState);
  const isUploading = uploadState.status === "uploading";

  function openPicker() {
    if (!isUploading) {
      inputRef.current?.click();
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function uploadBackupFile(file: File) {
    if (isUploading) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setUploadOpen(true);
    setUploadState({
      status: "uploading",
      progress: 0,
      filename: file.name,
      message: text.uploadProgressReady
    });

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      const progress = event.lengthComputable && event.total > 0
        ? Math.min(95, Math.round((event.loaded / event.total) * 100))
        : 8;

      setUploadState({
        status: "uploading",
        progress,
        filename: file.name,
        message: text.uploadProgressRunning
      });
    };

    xhr.onload = () => {
      let result: { ok?: boolean; message?: string } = {};
      try {
        result = JSON.parse(xhr.responseText || "{}") as { ok?: boolean; message?: string };
      } catch {
        result = { ok: false, message: text.uploadProgressFailed };
      }

      if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
        setUploadState({
          status: "success",
          progress: 100,
          filename: file.name,
          message: result.message || text.uploadProgressSuccess
        });
        clearSelectedFile();
        router.refresh();
        return;
      }

      setUploadState({
        status: "error",
        progress: 100,
        filename: file.name,
        message: result.message || text.uploadProgressFailed
      });
    };

    xhr.onerror = () => {
      setUploadState({
        status: "error",
        progress: 100,
        filename: file.name,
        message: text.uploadProgressFailed
      });
    };

    xhr.onabort = xhr.onerror;
    xhr.open("POST", "/api/console/backups/upload");
    xhr.send(formData);
  }

  function uploadSelectedFile() {
    if (!selectedFile) {
      return;
    }
    uploadBackupFile(selectedFile);
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-xl font-semibold">{text.uploadBackupFile}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text.uploadBackupDescription}</p>
      <div className="mt-4 grid gap-3">
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="application/gzip,application/x-gzip,application/json,.tar.gz,.tgz,.json"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            setSelectedFile(file);
            if (file) {
              uploadBackupFile(file);
            }
          }}
        />
        <button
          type="button"
          className="group flex min-h-24 w-full items-center gap-4 rounded-lg border border-dashed bg-background/65 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          onClick={openPicker}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
            <FileArchive className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">
              {selectedFile ? selectedFile.name : text.chooseBackupFile}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {selectedFile
                ? `${formatFileSize(selectedFile.size)} / ${new Date(selectedFile.lastModified).toLocaleString()}`
                : text.backupFileSupport}
            </span>
          </span>
          {selectedFile && !isUploading ? (
            <span
              role="button"
              tabIndex={0}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                clearSelectedFile();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  clearSelectedFile();
                }
              }}
            >
              <X className="h-4 w-4" />
            </span>
          ) : (
            <span className="inline-flex h-10 items-center gap-2 rounded-md bg-muted px-3 text-sm font-medium text-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {isUploading ? text.uploadingBackup : text.browse}
            </span>
          )}
        </button>
      </div>
      <BackupUploadDialog
        open={uploadOpen}
        state={uploadState}
        onOpenChange={setUploadOpen}
        onRetry={uploadSelectedFile}
        text={text}
      />
    </section>
  );
}

function BackupRow({
  backup,
  deleteState,
  storedRestoreState,
  isDeleting,
  isStoredRestoring,
  deleteAction,
  storedRestoreAction,
  onDeleteStart,
  onRestoreStart,
  text
}: {
  backup: BackupItem;
  deleteState: BackupActionState;
  storedRestoreState: BackupActionState;
  isDeleting: boolean;
  isStoredRestoring: boolean;
  deleteAction: (formData: FormData) => void;
  storedRestoreAction: (formData: FormData) => void;
  onDeleteStart: () => void;
  onRestoreStart: () => void;
  text: BackupPanelText;
}) {
  const restoreFormRef = useRef<HTMLFormElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreAttempted, setRestoreAttempted] = useState(false);

  return (
    <div>
      <form ref={restoreFormRef} action={storedRestoreAction} className="hidden">
        <input type="hidden" name="id" value={backup.id} />
      </form>
      <div className="grid gap-4 border-b p-5 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <p className="truncate font-medium">{backup.filename}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {backup.createdAtLabel} / {backup.sizeLabel} / {backup.status} / {backup.reason ?? text.manual}
          </p>
          {backup.error ? <p className="mt-1 text-xs text-destructive">{backup.error}</p> : null}
          <div className="mt-2 space-y-1">
            <StateMessage state={deleteState} />
            <StateMessage state={storedRestoreState} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex h-10 items-center rounded-md bg-muted px-4 text-sm font-medium transition hover:bg-muted/80"
            href={`/console/backup/${backup.id}/download`}
            download
          >
            {text.download}
          </a>
          <Button
            type="button"
            variant="danger"
            disabled={isStoredRestoring}
            onClick={() => {
              onRestoreStart();
              setRestoreAttempted(true);
              setRestoreOpen(true);
              window.setTimeout(() => restoreFormRef.current?.requestSubmit(), 0);
            }}
          >
            {isStoredRestoring ? text.restoring : text.restore}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isDeleting}
            onClick={() => {
              onDeleteStart();
              setDeleteConfirmOpen(true);
            }}
          >
            {isDeleting ? text.deleting : text.delete}
          </Button>
        </div>
      </div>
      <ConfirmActionDialog
        open={deleteConfirmOpen}
        title={text.delete}
        description={interpolate(text.deleteBackupDescription, { filename: backup.filename })}
        confirmLabel={text.delete}
        cancelLabel={text.cancel}
        closeLabel={text.close}
        pending={isDeleting}
        onOpenChange={setDeleteConfirmOpen}
        action={deleteAction}
        hiddenFields={[{ name: "id", value: backup.id }]}
      />
      <RestoreProgressDialog
        open={restoreOpen}
        title={text.confirmRestore}
        description={text.restoreWarningBody}
        itemLabel={`${text.restoreSelectedBackup}: ${backup.filename}`}
        state={restoreAttempted ? storedRestoreState : initialState}
        pending={isStoredRestoring}
        onOpenChange={setRestoreOpen}
        onConfirm={() => {
          onRestoreStart();
          setRestoreAttempted(true);
          restoreFormRef.current?.requestSubmit();
        }}
        text={text}
      />
    </div>
  );
}

function BackupListSection({
  backups,
  deleteState,
  storedRestoreState,
  isDeleting,
  isStoredRestoring,
  syncState,
  isSyncing,
  deleteAction,
  storedRestoreAction,
  syncAction,
  activeDeleteId,
  activeRestoreId,
  setActiveDeleteId,
  setActiveRestoreId,
  text
}: {
  backups: BackupItem[];
  deleteState: BackupActionState;
  storedRestoreState: BackupActionState;
  isDeleting: boolean;
  isStoredRestoring: boolean;
  syncState: BackupActionState;
  isSyncing: boolean;
  deleteAction: (formData: FormData) => void;
  storedRestoreAction: (formData: FormData) => void;
  syncAction: (formData: FormData) => void;
  activeDeleteId: string | null;
  activeRestoreId: string | null;
  setActiveDeleteId: (id: string) => void;
  setActiveRestoreId: (id: string) => void;
  text: BackupPanelText;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{text.backupList}</h2>
          <StateMessage state={syncState} />
        </div>
        <form action={syncAction}>
          <Button type="submit" variant="secondary" disabled={isSyncing}>
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {text.refreshBackups}
          </Button>
        </form>
      </div>
      {backups.length ? (
        backups.map((backup) => {
          const rowDeleteState = deleteState.id === backup.id ? deleteState : initialState;
          const rowRestoreState = storedRestoreState.id === backup.id ? storedRestoreState : initialState;

          return (
            <BackupRow
              key={backup.id}
              backup={backup}
              deleteState={rowDeleteState}
              storedRestoreState={rowRestoreState}
              isDeleting={isDeleting && activeDeleteId === backup.id}
              isStoredRestoring={isStoredRestoring && activeRestoreId === backup.id}
              deleteAction={deleteAction}
              storedRestoreAction={storedRestoreAction}
              onDeleteStart={() => setActiveDeleteId(backup.id)}
              onRestoreStart={() => setActiveRestoreId(backup.id)}
              text={text}
            />
          );
        })
      ) : (
        <div className="p-5">
          <EmptyState title={text.noBackups} description={text.noBackupsDescription} />
        </div>
      )}
    </section>
  );
}

export function BackupPanel({
  backups,
  schedule,
  text
}: {
  backups: BackupItem[];
  schedule: BackupSchedule;
  text: BackupPanelText;
}) {
  const [scheduleState, scheduleAction, isSavingSchedule] = useActionState<BackupActionState, FormData>(
    updateBackupScheduleAction,
    initialState
  );
  const [deleteState, deleteAction, isDeleting] = useActionState<BackupActionState, FormData>(
    deleteBackupAction,
    initialState
  );
  const [storedRestoreState, storedRestoreAction, isStoredRestoring] = useActionState<BackupActionState, FormData>(
    restoreStoredBackupAction,
    initialState
  );
  const [syncState, syncAction, isSyncing] = useActionState<BackupActionState, FormData>(
    syncBackupDirectoryAction,
    initialState
  );
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  const [activeRestoreId, setActiveRestoreId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!schedule.enabled) {
      return;
    }

    const refreshWhenVisible = () => {
      if (!document.hidden) {
        router.refresh();
      }
    };

    const interval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router, schedule.enabled]);

  return (
    <div className="space-y-6">
      <ScheduleSection
        schedule={schedule}
        state={scheduleState}
        action={scheduleAction}
        pending={isSavingSchedule}
        text={text}
      />
      <UploadBackupSection text={text} />
      <BackupListSection
        backups={backups}
        deleteState={deleteState}
        storedRestoreState={storedRestoreState}
        isDeleting={isDeleting}
        isStoredRestoring={isStoredRestoring}
        syncState={syncState}
        isSyncing={isSyncing}
        deleteAction={deleteAction}
        storedRestoreAction={storedRestoreAction}
        syncAction={syncAction}
        activeDeleteId={activeDeleteId}
        activeRestoreId={activeRestoreId}
        setActiveDeleteId={setActiveDeleteId}
        setActiveRestoreId={setActiveRestoreId}
        text={text}
      />
    </div>
  );
}
