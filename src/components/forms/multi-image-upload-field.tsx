"use client";

/* eslint-disable @next/next/no-img-element */

import { ImageUp, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadProgressDialog } from "@/components/forms/upload-progress-dialog";
import type { Locale } from "@/lib/i18n";
import { emptyUploadProgress, uploadImageFile, type UploadProgressState } from "@/lib/upload-client";

function text(locale: Locale) {
  return locale === "en"
    ? {
        add: "Add images",
        empty: "No images uploaded yet.",
        uploadSuccess: "Images uploaded.",
        uploadFailure: "Image upload failed."
      }
    : {
        add: "添加图片",
        empty: "暂时没有图片。",
        uploadSuccess: "图片已上传。",
        uploadFailure: "图片上传失败。"
      };
}

export function MultiImageUploadField({
  name,
  defaultValue = [],
  locale = "zh-CN"
}: {
  name: string;
  defaultValue?: string[];
  locale?: Locale;
}) {
  const copy = text(locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState(defaultValue);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadProgressState>(() => emptyUploadProgress());

  async function upload(files: FileList) {
    setMessage("");
    setIsUploading(true);
    setUploadOpen(true);

    try {
      for (const [index, file] of Array.from(files).entries()) {
        const result = await uploadImageFile(file, (state) => {
          setUploadState({
            ...state,
            message: state.status === "uploading"
              ? `${state.message} (${index + 1}/${files.length})`
              : state.message
          });
        });

        if (!result.ok || !result.asset?.url) {
          setMessage(result.message ?? copy.uploadFailure);
          return;
        }

        setUrls((current) => [...current, result.asset!.url].slice(0, 9));
      }

      setMessage(copy.uploadSuccess);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={urls.join(",")} />
      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          if (event.target.files?.length) {
            void upload(event.target.files);
          }
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={isUploading || urls.length >= 9}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageUp className="mr-2 h-4 w-4" />}
        {copy.add}
      </Button>
      {urls.length ? (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url) => (
            <div key={url} className="group relative overflow-hidden rounded-md border bg-muted">
              <img src={url} alt="" className="h-24 w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-background/85 p-1 opacity-0 shadow-sm transition group-hover:opacity-100"
                onClick={() => setUrls((current) => current.filter((item) => item !== url))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">{copy.empty}</div>
      )}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      <UploadProgressDialog open={uploadOpen} state={uploadState} onOpenChange={setUploadOpen} />
    </div>
  );
}
