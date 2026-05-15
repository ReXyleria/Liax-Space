"use client";

import { useId, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type HiddenField = {
  name: string;
  value: string;
};

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending = false,
  onConfirm,
  onOpenChange,
  action,
  hiddenFields = [],
  children
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm?: () => void;
  onOpenChange: (open: boolean) => void;
  action?: (formData: FormData) => void | Promise<void>;
  hiddenFields?: HiddenField[];
  children?: ReactNode;
}) {
  const formId = useId();
  const dialogBody = (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      title={title}
      onOpenChange={(nextOpen) => {
        if (!pending) {
          onOpenChange(nextOpen);
        }
      }}
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type={action ? "submit" : "button"}
            form={action ? formId : undefined}
            variant="danger"
            disabled={pending}
            onClick={action ? undefined : onConfirm}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {action ? (
        <form id={formId} action={action} className="space-y-4">
          {hiddenFields.map((field) => (
            <input key={field.name} type="hidden" name={field.name} value={field.value} />
          ))}
          {dialogBody}
        </form>
      ) : (
        dialogBody
      )}
    </Dialog>
  );
}
