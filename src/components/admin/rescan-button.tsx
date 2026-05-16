"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rescanMediaAction, type MediaActionState } from "@/features/media/actions";

export function RescanButton() {
  const [state, formAction, isPending] = useActionState<MediaActionState, FormData>(
    async () => {
      try {
        await rescanMediaAction();
        return { ok: true, message: "引用扫描完成。" };
      } catch {
        return { ok: false, message: "扫描引用失败，请稍后重试。" };
      }
    },
    { ok: false, message: "" }
  );

  return (
    <div className="flex items-center gap-3">
      <form action={formAction}>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isPending ? "扫描中..." : "重新扫描引用"}
        </Button>
      </form>
      {state.message ? (
        <span
          className={
            state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"
          }
        >
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
