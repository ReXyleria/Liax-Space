import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FloatingSettingsSubmit({
  pending,
  message,
  ok,
  locale = "zh-CN",
  className
}: {
  pending?: boolean;
  message?: string;
  ok?: boolean;
  locale?: "zh-CN" | "en";
  className?: string;
}) {
  const saveLabel = locale === "en" ? "Save settings" : "保存设置";
  const savingLabel = locale === "en" ? "Saving..." : "保存中...";

  return (
    <div className={cn("fixed bottom-6 right-6 z-[80] flex max-w-[calc(100vw-3rem)] items-end gap-3", className)}>
      {message ? (
        <div
          className={cn(
            "max-w-xs rounded-lg border bg-white/95 px-3 py-2 text-sm shadow-xl shadow-slate-950/10 backdrop-blur-xl",
            ok ? "border-emerald-200 text-emerald-700" : "border-destructive/25 text-destructive"
          )}
        >
          {message}
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="h-12 rounded-full px-5 shadow-xl shadow-primary/25">
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {pending ? savingLabel : saveLabel}
      </Button>
    </div>
  );
}
