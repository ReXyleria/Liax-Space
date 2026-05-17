"use client";

import { useActionState, useRef, useState } from "react";
import { FileArchive, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import {
  deleteBackupAction,
  restoreBackupAction,
  restoreStoredBackupAction,
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
  restoreFromUpload: string;
  restoreFromUploadDescription: string;
  chooseBackupFile: string;
  backupFileSupport: string;
  browse: string;
  restore: string;
  restoring: string;
  backupList: string;
  noBackups: string;
  noBackupsDescription: string;
  download: string;
  delete: string;
  deleting: string;
  cancel: string;
  restoreWarning: string;
  restoreWarningBody: string;
  typeRestoreToConfirm: string;
  confirmRestore: string;
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

function UploadRestoreSection({
  state,
  action,
  pending,
  text
}: {
  state: BackupActionState;
  action: (formData: FormData) => void;
  pending: boolean;
  text: BackupPanelText;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-xl font-semibold">{text.restoreFromUpload}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text.restoreFromUploadDescription}</p>
      <form
        ref={formRef}
        action={action}
        className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_auto]"
        onSubmit={(event) => {
          if (confirmed) {
            setConfirmed(false);
            return;
          }
          event.preventDefault();
          setConfirmOpen(true);
        }}
      >
        <input
          ref={inputRef}
          className="sr-only"
          name="backupFile"
          type="file"
          accept="application/gzip,application/x-gzip,application/json,.tar.gz,.tgz,.json"
          onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)}
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
          {selectedFile ? (
            <span
              role="button"
              tabIndex={0}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFile(null);
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedFile(null);
                  if (inputRef.current) {
                    inputRef.current.value = "";
                  }
                }
              }}
            >
              <X className="h-4 w-4" />
            </span>
          ) : (
            <span className="inline-flex h-10 items-center gap-2 rounded-md bg-muted px-3 text-sm font-medium text-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
              <UploadCloud className="h-4 w-4" />
              {text.browse}
            </span>
          )}
        </button>
        <Input name="confirm" placeholder="RESTORE" />
        <Button type="submit" variant="danger" disabled={pending || !selectedFile}>
          {pending ? text.restoring : text.restore}
        </Button>
      </form>
      <div className="mt-3">
        <StateMessage state={state} />
      </div>
      <ConfirmActionDialog
        open={confirmOpen}
        title={text.confirmRestore}
        description={text.restoreWarningBody}
        confirmLabel={text.confirmRestore}
        cancelLabel={text.cancel}
        pending={pending}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setConfirmed(true);
          setConfirmOpen(false);
          window.setTimeout(() => formRef.current?.requestSubmit(), 0);
        }}
      />
    </section>
  );
}

function BackupRow({
  backup,
  confirming,
  confirmText,
  deleteState,
  storedRestoreState,
  isDeleting,
  isStoredRestoring,
  deleteAction,
  storedRestoreAction,
  onToggleRestore,
  onConfirmTextChange,
  text
}: {
  backup: BackupItem;
  confirming: boolean;
  confirmText: string;
  deleteState: BackupActionState;
  storedRestoreState: BackupActionState;
  isDeleting: boolean;
  isStoredRestoring: boolean;
  deleteAction: (formData: FormData) => void;
  storedRestoreAction: (formData: FormData) => void;
  onToggleRestore: (id: string | null) => void;
  onConfirmTextChange: (value: string) => void;
  text: BackupPanelText;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  return (
    <div>
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
            href={`/admin/backup/${backup.id}/download`}
            download
          >
            {text.download}
          </a>
          <Button
            type="button"
            variant={confirming ? "secondary" : "danger"}
            disabled={isStoredRestoring}
            onClick={() => onToggleRestore(confirming ? null : backup.id)}
          >
            {confirming ? text.cancel : text.restore}
          </Button>
          <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setDeleteConfirmOpen(true)}>
            {isDeleting ? text.deleting : text.delete}
          </Button>
        </div>
      </div>
      {confirming ? (
        <div className="border-b bg-muted/30 px-5 pb-4 pt-3 last:border-b-0">
          <p className="text-sm font-medium text-destructive">{text.restoreWarning}</p>
          <p className="mt-1 text-sm text-muted-foreground">{text.restoreWarningBody}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={backup.id} />
            <Input
              name="confirm"
              placeholder={text.typeRestoreToConfirm}
              value={confirmText}
              onChange={(event) => onConfirmTextChange(event.target.value)}
              className="w-60"
            />
            <Button
              type="button"
              variant="danger"
              disabled={confirmText !== "RESTORE" || isStoredRestoring}
              onClick={() => setRestoreConfirmOpen(true)}
            >
              {isStoredRestoring ? text.restoring : text.confirmRestore}
            </Button>
          </div>
        </div>
      ) : null}
      <ConfirmActionDialog
        open={deleteConfirmOpen}
        title={text.delete}
        description={`${backup.filename} will be permanently deleted from the backup list.`}
        confirmLabel={text.delete}
        cancelLabel={text.cancel}
        pending={isDeleting}
        onOpenChange={setDeleteConfirmOpen}
        action={deleteAction}
        hiddenFields={[{ name: "id", value: backup.id }]}
      />
      <ConfirmActionDialog
        open={restoreConfirmOpen}
        title={text.confirmRestore}
        description={text.restoreWarningBody}
        confirmLabel={text.confirmRestore}
        cancelLabel={text.cancel}
        pending={isStoredRestoring}
        onOpenChange={setRestoreConfirmOpen}
        action={storedRestoreAction}
        hiddenFields={[
          { name: "id", value: backup.id },
          { name: "confirm", value: "RESTORE" }
        ]}
      />
    </div>
  );
}

function BackupListSection({
  backups,
  confirmingRestoreId,
  confirmText,
  deleteState,
  storedRestoreState,
  isDeleting,
  isStoredRestoring,
  deleteAction,
  storedRestoreAction,
  onToggleRestore,
  onConfirmTextChange,
  text
}: {
  backups: BackupItem[];
  confirmingRestoreId: string | null;
  confirmText: string;
  deleteState: BackupActionState;
  storedRestoreState: BackupActionState;
  isDeleting: boolean;
  isStoredRestoring: boolean;
  deleteAction: (formData: FormData) => void;
  storedRestoreAction: (formData: FormData) => void;
  onToggleRestore: (id: string | null) => void;
  onConfirmTextChange: (value: string) => void;
  text: BackupPanelText;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b p-5">
        <h2 className="text-xl font-semibold">{text.backupList}</h2>
      </div>
      {backups.length ? (
        backups.map((backup) => (
          <BackupRow
            key={backup.id}
            backup={backup}
            confirming={confirmingRestoreId === backup.id}
            confirmText={confirmText}
            deleteState={deleteState}
            storedRestoreState={storedRestoreState}
            isDeleting={isDeleting}
            isStoredRestoring={isStoredRestoring}
            deleteAction={deleteAction}
            storedRestoreAction={storedRestoreAction}
            onToggleRestore={onToggleRestore}
            onConfirmTextChange={onConfirmTextChange}
            text={text}
          />
        ))
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
  const [restoreState, restoreAction, isRestoring] = useActionState<BackupActionState, FormData>(
    restoreBackupAction,
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
  const [confirmingRestoreId, setConfirmingRestoreId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  function toggleRestore(id: string | null) {
    setConfirmingRestoreId(id);
    setConfirmText("");
  }

  return (
    <div className="space-y-6">
      <ScheduleSection
        schedule={schedule}
        state={scheduleState}
        action={scheduleAction}
        pending={isSavingSchedule}
        text={text}
      />
      <UploadRestoreSection state={restoreState} action={restoreAction} pending={isRestoring} text={text} />
      <BackupListSection
        backups={backups}
        confirmingRestoreId={confirmingRestoreId}
        confirmText={confirmText}
        deleteState={deleteState}
        storedRestoreState={storedRestoreState}
        isDeleting={isDeleting}
        isStoredRestoring={isStoredRestoring}
        deleteAction={deleteAction}
        storedRestoreAction={storedRestoreAction}
        onToggleRestore={toggleRestore}
        onConfirmTextChange={setConfirmText}
        text={text}
      />
    </div>
  );
}
