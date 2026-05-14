import { MailSendStatus, type MailTemplateScene } from "@prisma/client";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n";

type MailLogItem = {
  id: string;
  scene: MailTemplateScene;
  to: string;
  subject: string | null;
  status: MailSendStatus;
  error: string | null;
  createdAtLabel: string;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        title: "Recent send logs",
        to: "To",
        subject: "Subject",
        empty: "No mail send logs yet."
      }
    : {
        title: "最近发送日志",
        to: "收件人",
        subject: "主题",
        empty: "暂无邮件发送日志。"
      };
}

export function MailLogsPanel({ logs, locale = "zh-CN" }: { logs: MailLogItem[]; locale?: Locale }) {
  const text = labels(locale);
  return (
    <Card className="p-5">
      <h2 className="text-xl font-semibold">{text.title}</h2>
      <div className="mt-4 space-y-2">
        {logs.length ? (
          logs.map((log) => (
            <div key={log.id} className="rounded-md border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{log.scene}</span>
                <span
                  className={
                    log.status === MailSendStatus.SENT
                      ? "text-emerald-600"
                      : log.status === MailSendStatus.SKIPPED
                        ? "text-amber-600"
                        : "text-destructive"
                  }
                >
                  {log.status}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {text.to}: {log.to} · {log.createdAtLabel}
              </p>
              {log.subject ? <p className="mt-1 text-muted-foreground">{text.subject}: {log.subject}</p> : null}
              {log.error ? <p className="mt-1 text-destructive">{log.error}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{text.empty}</p>
        )}
      </div>
    </Card>
  );
}
