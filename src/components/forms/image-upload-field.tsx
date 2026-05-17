"use client";

/* eslint-disable @next/next/no-img-element */

import { ImageUp, Loader2, Shuffle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadProgressDialog } from "@/components/forms/upload-progress-dialog";
import { cn } from "@/lib/utils";
import { emptyUploadProgress, uploadImageFile, type UploadProgressState } from "@/lib/upload-client";

export function ImageUploadField({
  name,
  value: controlledValue,
  defaultValue = "",
  label = "图片",
  helper,
  compact = false,
  previewFit = "cover",
  showRandomOption = false,
  randomUrl = "https://photo.toliax.com/random",
  onValueChange
}: {
  name: string;
  value?: string | null;
  defaultValue?: string | null;
  label?: string;
  helper?: string;
  compact?: boolean;
  previewFit?: "cover" | "contain";
  showRandomOption?: boolean;
  randomUrl?: string;
  onValueChange?: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(controlledValue ?? defaultValue ?? "");
  const [message, setMessage] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadProgressState>(() => emptyUploadProgress());
  const isUploading = uploadState.status === "uploading";

  useEffect(() => {
    if (controlledValue !== undefined) {
      setValue(controlledValue ?? "");
    }
  }, [controlledValue]);

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
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {showRandomOption ? (
            <Button type="button" variant="secondary" disabled={isUploading} onClick={() => setNextValue(randomUrl)}>
              <Shuffle className="mr-2 h-4 w-4" />
              随机图
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageUp className="mr-2 h-4 w-4" />}
            上传
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-muted/30",
          compact ? "h-24" : "h-40"
        )}
      >
        {value ? (
          <img
            src={value}
            alt={label}
            className={cn("h-full w-full", previewFit === "contain" ? "object-contain" : "object-cover")}
          />
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
