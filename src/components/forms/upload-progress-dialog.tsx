"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!open || state.status !== "success") {
      return;
    }

    const timer = window.setTimeout(() => onOpenChange(false), 800);
    return () => window.clearTimeout(timer);
  }, [onOpenChange, open, state.status]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isUploading) {
          return;
        }
        onOpenChange(nextOpen);
      }}
      title="上传图片"
      description={isUploading ? "图片上传中，请保持当前页面打开。" : state.message}
      closeLabel="关闭"
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
            <p className="truncate font-medium">{state.filename || "图片"}</p>
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
