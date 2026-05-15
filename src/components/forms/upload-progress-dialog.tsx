"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { UploadProgressState } from "@/lib/upload-client";

export function UploadProgressDialog({
  open,
  state,
  onOpenChange
}: {
  open: boolean;
  state: UploadProgressState;
  onOpenChange: (open: boolean) => void;
}) {
  const isUploading = state.status === "uploading";
  const progress = Math.max(0, Math.min(100, state.progress));

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isUploading) {
          return;
        }
        onOpenChange(nextOpen);
      }}
      title="Upload image"
      description={isUploading ? "Keep this page open while the image is uploading." : state.message}
      className="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            {state.status === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : state.status === "error" ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{state.filename || "Image"}</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={
                state.status === "error"
                  ? "h-full bg-destructive transition-all"
                  : "h-full bg-primary transition-all"
              }
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-muted-foreground">{progress}%</p>
        </div>
      </div>
    </Dialog>
  );
}
