"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { deleteMediaAssetsAction, type MediaActionState } from "@/features/media/actions";

type MediaAssetItem = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAtLabel: string;
  isUnused: boolean;
  unusedSinceLabel: string;
  references: Array<{ source: string; sourceId: string }>;
};

const initialState: MediaActionState = { ok: false, message: "" };

export function MediaUnusedPanel({ locale, assets }: { locale?: string; assets: MediaAssetItem[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<MediaActionState, FormData>(
    deleteMediaAssetsAction,
    initialState
  );
  const prevStateRef = useRef(state);

  const selectedAssets = assets.filter((asset) => selectedIds.includes(asset.id));

  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;

    if (state.ok) {
      setConfirmOpen(false);
      setSelectedIds([]);
    }
  }, [state]);

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
  }

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!isPending) {
        setConfirmOpen(open);
      }
    },
    [isPending]
  );

  return (
    <div className="space-y-4">
      {assets.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <ThemedCheckbox
              key={asset.id}
              name={`asset-toggle-${asset.id}`}
              value={asset.id}
              className="bg-card"
              checked={selectedIds.includes(asset.id)}
              onCheckedChange={(checked) => toggleSelected(asset.id, checked)}
            >
              <div className="relative h-40 overflow-hidden rounded-md bg-muted">
                {asset.mimeType.startsWith("image/") ? (
                  <Image src={asset.url} alt={asset.filename} fill sizes="320px" className="object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">{asset.mimeType}</div>
                )}
              </div>
              <p className="mt-3 truncate font-medium">{asset.filename}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(asset.size / 1024)} KB · {asset.mimeType} · {asset.createdAtLabel}
              </p>
              <p className={asset.references.length ? "mt-2 text-xs text-emerald-600" : "mt-2 text-xs text-amber-600"}>
                {asset.references.length ? `已使用：${asset.references.map((ref) => ref.source).join(", ")}` : "未引用"}
                {asset.isUnused && asset.unusedSinceLabel ? ` · 未使用自 ${asset.unusedSinceLabel}` : ""}
              </p>
            </ThemedCheckbox>
          ))}
        </div>
      ) : (
        <p className="rounded-md border bg-muted/35 p-5 text-sm text-muted-foreground">当前筛选条件下没有附件。</p>
      )}
      <div className="flex flex-col gap-3 rounded-md border bg-muted/35 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          已选择 {selectedIds.length} 个附件。删除前服务端会重新检查引用，仍被引用的附件会被阻止。
        </p>
        <Button type="button" variant="danger" disabled={!selectedIds.length} onClick={() => setConfirmOpen(true)}>
          删除选中
        </Button>
      </div>
      {state.message && state.ok ? (
        <p className="text-sm text-emerald-600">{state.message}</p>
      ) : null}
      <ConfirmActionDialog
        open={confirmOpen}
        title="确认删除附件"
        description={`将删除 ${selectedIds.length} 个附件。仍被引用的附件会在服务端被阻止。`}
        confirmLabel={isPending ? "删除中..." : "确认删除"}
        cancelLabel="取消"
        pending={isPending}
        onOpenChange={handleOpenChange}
        action={formAction}
        hiddenFields={[
          { name: "locale", value: locale ?? "zh-CN" },
          ...selectedIds.map((id) => ({ name: "assetId", value: id }))
        ]}
      >
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border bg-muted/35 p-3 text-sm">
          {selectedAssets.map((asset) => (
            <p key={asset.id} className="truncate">{asset.filename}</p>
          ))}
        </div>
        {!state.ok && state.message ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
        ) : null}
      </ConfirmActionDialog>
    </div>
  );
}
