import { Activity, Database, FolderCheck, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DetailRow,
  ErrorLine,
  formatDateTime,
  formatSize,
  StatusPill,
  statusLabel,
  SummaryCard,
  yesNo
} from "@/components/console/system-health-primitives";
import { healthText } from "@/components/console/system-health-text";
import type { SystemHealthReport } from "@/features/system-health/types";
import type { Locale } from "@/lib/i18n";

function queueActiveCount(report: SystemHealthReport) {
  return report.queues.article.QUEUED + report.queues.article.RUNNING
    + report.queues.publicContent.QUEUED + report.queues.publicContent.RUNNING;
}

function queueIssueCount(report: SystemHealthReport) {
  return report.queues.article.FAILED + report.queues.article.staleRunning
    + report.queues.publicContent.FAILED + report.queues.publicContent.staleRunning;
}

export function SystemHealthPanel({ report, locale }: { report: SystemHealthReport; locale: Locale }) {
  const text = healthText(locale);
  const activeQueueCount = queueActiveCount(report);
  const queueIssues = queueIssueCount(report);
  const directoriesStatus = report.directories.some((item) => item.status === "critical") ? "critical" : "ok";

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{text.overall}</p>
            <h2 className="mt-1 text-2xl font-semibold">{statusLabel(text, report.overallStatus)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {text.generatedAt}: {formatDateTime(locale, text, report.generatedAt)}
            </p>
          </div>
          <StatusPill status={report.overallStatus} text={text} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title={text.database}
          value={report.database.status === "ok" ? text.connected : text.failed}
          status={report.database.status}
          icon={Database}
          text={text}
        />
        <SummaryCard
          title={text.directories}
          value={`${report.directories.filter((item) => item.writable).length}/${report.directories.length}`}
          status={directoriesStatus}
          icon={FolderCheck}
          text={text}
        />
        <SummaryCard
          title={text.queues}
          value={`${text.activeQueues} ${activeQueueCount}${queueIssues ? ` / ${text.queueIssues} ${queueIssues}` : ""}`}
          status={report.queues.status}
          icon={Activity}
          text={text}
        />
        <SummaryCard title={text.security} value={String(report.security.activeAdminUsers)} status={report.security.status} icon={ShieldCheck} text={text} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{text.database}</h2>
            <StatusPill status={report.database.status} text={text} />
          </div>
          <DetailRow label={text.configured} value={yesNo(text, report.database.configured)} />
          <DetailRow label={text.source} value={report.database.source} />
          <DetailRow label={text.host} value={report.database.host || text.unavailable} mono />
          <DetailRow label={text.port} value={report.database.port || text.unavailable} />
          <DetailRow label={text.databaseName} value={report.database.database || text.unavailable} mono />
          <DetailRow label={text.user} value={report.database.user || text.unavailable} mono />
          <DetailRow label={text.latency} value={report.database.latencyMs === null ? text.unavailable : `${report.database.latencyMs} ms`} />
          <DetailRow label={text.missingEnv} value={report.database.missingMysqlEnv.length ? report.database.missingMysqlEnv.join(", ") : text.none} />
          <ErrorLine value={report.database.error} />
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{text.runtime}</h2>
            <StatusPill status="ok" text={text} />
          </div>
          <DetailRow label={text.nodeEnv} value={report.runtime.nodeEnv} />
          <DetailRow label={text.nodeVersion} value={report.runtime.nodeVersion} />
          <DetailRow label={text.timezone} value={report.runtime.timezone} />
          <DetailRow label={text.workerMode} value={report.runtime.workerMode} />
          <DetailRow label={text.workerRole} value={report.runtime.workerRole} />
          <DetailRow label={text.inProcessWorkers} value={yesNo(text, report.runtime.inProcessWorkersEnabled)} />
        </Card>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{text.directories}</h2>
          <StatusPill status={directoriesStatus} text={text} />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {report.directories.map((item) => (
            <div key={item.key} className="space-y-2 rounded-lg border border-white/60 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{item.key}</span>
                <StatusPill status={item.status} text={text} />
              </div>
              <DetailRow label={text.exists} value={yesNo(text, item.exists)} />
              <DetailRow label={text.writable} value={yesNo(text, item.writable)} />
              <DetailRow label={text.entries} value={item.entries === null ? text.unavailable : String(item.entries)} />
              <DetailRow label={text.path} value={item.path} mono />
              <ErrorLine value={item.error} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{text.backup}</h2>
            <StatusPill status={report.backup.status} text={text} />
          </div>
          <DetailRow label={text.schedule} value={report.backup.scheduleEnabled ? text.enabled : text.disabled} />
          <DetailRow label={text.frequency} value={report.backup.frequency} />
          <DetailRow label={text.time} value={report.backup.time} />
          <DetailRow label={text.retention} value={`${report.backup.retentionDays} ${text.daySuffix}`} />
          <DetailRow label={text.lastRun} value={formatDateTime(locale, text, report.backup.lastRunAt)} />
          <DetailRow label={text.lastStatus} value={report.backup.lastRunStatus || text.none} />
          <DetailRow label={text.failedLast7Days} value={String(report.backup.failedLast7Days)} />
          <DetailRow
            label={text.latestBackup}
            value={report.backup.latestBackup
              ? `${report.backup.latestBackup.filename} · ${formatSize(report.backup.latestBackup.sizeBytes)} · ${formatDateTime(locale, text, report.backup.latestBackup.createdAt)}`
              : text.none}
            mono={Boolean(report.backup.latestBackup)}
          />
          <ErrorLine value={report.backup.error ?? report.backup.latestBackup?.error ?? undefined} />
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{text.queues}</h2>
            <StatusPill status={report.queues.status} text={text} />
          </div>
          <DetailRow label={`${text.articleQueue} ${text.queued}`} value={String(report.queues.article.QUEUED)} />
          <DetailRow label={`${text.articleQueue} ${text.running}`} value={String(report.queues.article.RUNNING)} />
          <DetailRow label={`${text.articleQueue} ${text.failedJobs}`} value={String(report.queues.article.FAILED)} />
          <DetailRow label={`${text.articleQueue} ${text.staleRunning}`} value={String(report.queues.article.staleRunning)} />
          <DetailRow label={`${text.publicQueue} ${text.queued}`} value={String(report.queues.publicContent.QUEUED)} />
          <DetailRow label={`${text.publicQueue} ${text.running}`} value={String(report.queues.publicContent.RUNNING)} />
          <DetailRow label={`${text.publicQueue} ${text.failedJobs}`} value={String(report.queues.publicContent.FAILED)} />
          <DetailRow label={`${text.publicQueue} ${text.staleRunning}`} value={String(report.queues.publicContent.staleRunning)} />
          <ErrorLine value={report.queues.error} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{text.mail}</h2>
            <StatusPill status={report.mail.status} text={text} />
          </div>
          <DetailRow label={text.notifications} value={report.mail.notificationsEnabled ? text.enabled : text.disabled} />
          <DetailRow label={text.ready} value={yesNo(text, report.mail.ready)} />
          <DetailRow label={text.source} value={report.mail.source} />
          <DetailRow label={text.host} value={yesNo(text, report.mail.hostConfigured)} />
          <DetailRow label={text.user} value={yesNo(text, report.mail.userConfigured)} />
          <DetailRow label={text.sender} value={yesNo(text, report.mail.fromConfigured)} />
          <DetailRow label={text.password} value={yesNo(text, report.mail.passwordConfigured)} />
          <DetailRow label={text.failedMail} value={String(report.mail.failedLast24Hours)} />
          <DetailRow label={text.skippedMail} value={String(report.mail.skippedLast24Hours)} />
          <ErrorLine value={report.mail.error} />
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{text.security}</h2>
            <StatusPill status={report.security.status} text={text} />
          </div>
          <DetailRow label={text.activeAdmins} value={String(report.security.activeAdminUsers)} />
          <DetailRow label={text.disabledAdmins} value={String(report.security.disabledAdminUsers)} />
          <DetailRow label={text.activeSessions} value={String(report.security.activeSessions)} />
          <DetailRow label={text.trustedDevices} value={String(report.security.trustedDevices)} />
          <DetailRow label={text.failOpen} value={String(report.security.smtpFailOpenLast24Hours)} />
          <DetailRow label={text.recentLogins} value={String(report.security.recentLoginEvents)} />
          <ErrorLine value={report.security.error} />
        </Card>
      </div>
    </div>
  );
}
