"use client";

/* eslint-disable @next/next/no-img-element */

import { ImageUp, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadProgressDialog } from "@/components/forms/upload-progress-dialog";
import { cn } from "@/lib/utils";
import { emptyUploadProgress, uploadImageFile, type UploadProgressState } from "@/lib/upload-client";

export function ImageUploadField({
  name,
  defaultValue = "",
  label = "图片",
  helper,
  compact = false,
  onValueChange
}: {
  name: string;
  defaultValue?: string | null;
  label?: string;
  helper?: string;
  compact?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [message, setMessage] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadProgressState>(() => emptyUploadProgress());
  const isUploading = uploadState.status === "uploading";

  function setNextValue(nextValue: string) {
    setValue(nextValue);
    onValueChange?.(nextValue);
  }

  async function upload(file: File) {
    setMessage("");
    setUploadOpen(true);
    const result = await uploadImageFile(file, setUploadState);

    if (!result.ok || !result.asset?.url) {
      setMessage(result.message ?? "上传失败");
      return;
    }

    setNextValue(result.asset.url);
    setMessage("上传完成");
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void upload(file);
            }
            event.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageUp className="mr-2 h-4 w-4" />}
          上传
        </Button>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-muted/30",
          compact ? "h-24" : "h-40"
        )}
      >
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            暂无图片
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          placeholder="也可以粘贴图片 URL"
          onChange={(event) => setNextValue(event.target.value)}
        />
        {value ? (
          <Button type="button" variant="ghost" className="px-3" onClick={() => setNextValue("")}>
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      <UploadProgressDialog open={uploadOpen} state={uploadState} onOpenChange={setUploadOpen} />
    </div>
  );
}
