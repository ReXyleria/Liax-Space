"use client";

/* eslint-disable @next/next/no-img-element */

import { ImageUp, Loader2, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

type UploadResponse = {
  ok: boolean;
  message?: string;
  asset?: { url: string };
};

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
  const [isPending, startTransition] = useTransition();

  function upload(files: FileList) {
    Array.from(files).forEach((file) => {
      const formData = new FormData();
      formData.append("file", file);

      startTransition(async () => {
        setMessage("");
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });
        const result = (await response.json()) as UploadResponse;

        if (!response.ok || !result.ok || !result.asset?.url) {
          setMessage(result.message ?? copy.uploadFailure);
          return;
        }

        setUrls((current) => [...current, result.asset!.url].slice(0, 9));
        setMessage(copy.uploadSuccess);
      });
    });
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
            upload(event.target.files);
          }
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={isPending || urls.length >= 9}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageUp className="mr-2 h-4 w-4" />}
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
    </div>
  );
}
