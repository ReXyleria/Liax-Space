import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { SystemHealthStatus } from "@/features/system-health/types";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { HealthText } from "@/components/console/system-health-text";

const statusIcon = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle
};

const statusClass = {
  ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  critical: "border-destructive/25 bg-destructive/10 text-destructive"
};

export function statusLabel(text: HealthText, status: SystemHealthStatus) {
  return text[status];
}

export function StatusPill({ status, text }: { status: SystemHealthStatus; text: HealthText }) {
  const Icon = statusIcon[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", statusClass[status])}>
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(text, status)}
    </span>
  );
}

export function formatDateTime(locale: Locale, text: HealthText, value: Date | null | undefined) {
  if (!value || Number.isNaN(value.getTime())) {
    return text.never;
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function formatSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function yesNo(text: HealthText, value: boolean) {
  return value ? text.yes : text.no;
}

export function DetailRow({
  label,
  value,
  mono = false
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-white/60 bg-background/60 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right text-sm font-medium", mono && "break-all font-mono text-xs")}>{value}</span>
    </div>
  );
}

export function SummaryCard({
  title,
  value,
  status,
  icon: Icon,
  text
}: {
  title: string;
  value: string;
  status: SystemHealthStatus;
  icon: React.ComponentType<{ className?: string }>;
  text: HealthText;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold">{value}</p>
          <StatusPill status={status} text={text} />
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

export function ErrorLine({ value }: { value?: string }) {
  if (!value) {
    return null;
  }
  return <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{value}</p>;
}
