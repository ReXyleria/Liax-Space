import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  FolderCheck,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { SystemHealthReport, SystemHealthStatus } from "@/features/system-health/service";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Text = ReturnType<typeof healthText>;

function healthText(locale: Locale) {
  return locale === "en"
    ? {
        generatedAt: "Generated",
        overall: "Overall status",
        ok: "Healthy",
        warning: "Needs attention",
        critical: "Action required",
        database: "Database",
        runtime: "Runtime",
        directories: "Runtime directories",
        backup: "Backup",
        queues: "Queues",
        mail: "Mail",
        security: "Security",
        configured: "Configured",
        notConfigured: "Not configured",
        connected: "Connected",
        failed: "Failed",
        source: "Source",
        host: "Host",
        port: "Port",
        databaseName: "Database",
        user: "User",
        missingEnv: "Missing MYSQL env",
        latency: "Latency",
        path: "Path",
        exists: "Exists",
        writable: "Writable",
        entries: "Entries",
        schedule: "Schedule",
        enabled: "Enabled",
        disabled: "Disabled",
        frequency: "Frequency",
        time: "Time",
        retention: "Retention",
        lastRun: "Last run",
        lastStatus: "Last status",
        latestBackup: "Latest backup",
        failedLast7Days: "Failed in 7 days",
        articleQueue: "Article translation",
        publicQueue: "Public content translation",
        queued: "Queued",
        running: "Running",
        failedJobs: "Failed",
        staleRunning: "Stale running",
        notifications: "Notifications",
        ready: "Ready",
        sender: "Sender",
        failedMail: "Failed in 24h",
        skippedMail: "Skipped in 24h",
        activeAdmins: "Active admins",
        disabledAdmins: "Disabled admins",
        activeSessions: "Active sessions",
        trustedDevices: "Trusted devices",
        failOpen: "SMTP fail-open logins",
        recentLogins: "Recent logins",
        nodeEnv: "Node env",
        nodeVersion: "Node version",
        timezone: "Timezone",
        workerMode: "Worker mode",
        workerRole: "Worker role",
        inProcessWorkers: "In-process workers",
        yes: "Yes",
        no: "No",
        none: "None",
        unavailable: "Unavailable",
        daySuffix: "days"
      }
    : {
        generatedAt: "生成时间",
        overall: "整体状态",
        ok: "健康",
        warning: "需要关注",
        critical: "需要处理",
        database: "数据库",
        runtime: "运行环境",
        directories: "运行目录",
        backup: "备份",
        queues: "队列",
        mail: "邮件",
        security: "安全",
        configured: "已配置",
        notConfigured: "未配置",
        connected: "已连接",
        failed: "失败",
        source: "来源",
        host: "主机",
        port: "端口",
        databaseName: "数据库",
        user: "用户",
        missingEnv: "缺少 MYSQL 环境变量",
        latency: "延迟",
        path: "路径",
        exists: "存在",
        writable: "可写",
        entries: "条目数",
        schedule: "计划",
        enabled: "启用",
        disabled: "停用",
        frequency: "频率",
        time: "时间",
        retention: "保留",
        lastRun: "上次执行",
        lastStatus: "上次状态",
        latestBackup: "最新备份",
        failedLast7Days: "7 天失败数",
        articleQueue: "文章翻译",
        publicQueue: "公共内容翻译",
        queued: "排队",
        running: "运行中",
        failedJobs: "失败",
        staleRunning: "停滞运行",
        notifications: "通知",
        ready: "就绪",
        sender: "发件配置",
        failedMail: "24 小时失败",
        skippedMail: "24 小时跳过",
        activeAdmins: "启用站长",
        disabledAdmins: "停用站长",
        activeSessions: "有效会话",
        trustedDevices: "信任设备",
        failOpen: "SMTP 失败放行登录",
        recentLogins: "最近登录",
        nodeEnv: "Node 环境",
        nodeVersion: "Node 版本",
        timezone: "时区",
        workerMode: "Worker 模式",
        workerRole: "Worker 角色",
        inProcessWorkers: "进程内 Worker",
        yes: "是",
        no: "否",
        none: "无",
        unavailable: "不可用",
        daySuffix: "天"
      };
}

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

function statusLabel(text: Text, status: SystemHealthStatus) {
  return text[status];
}

function StatusPill({ status, text }: { status: SystemHealthStatus; text: Text }) {
  const Icon = statusIcon[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", statusClass[status])}>
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(text, status)}
    </span>
  );
}

function formatDateTime(locale: Locale, value: Date | null | undefined) {
  if (!value || Number.isNaN(value.getTime())) {
    return locale === "en" ? "Never" : "从未";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function yesNo(text: Text, value: boolean) {
  return value ? text.yes : text.no;
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-white/60 bg-background/60 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right text-sm font-medium", mono && "break-all font-mono text-xs")}>{value}</span>
    </div>
  );
}

function SummaryCard({
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
  text: Text;
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

function ErrorLine({ value }: { value?: string }) {
  if (!value) {
    return null;
  }
  return <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{value}</p>;
}

function queueActiveCount(report: SystemHealthReport) {
  return report.queues.article.QUEUED + report.queues.article.RUNNING
    + report.queues.publicContent.QUEUED + report.queues.publicContent.RUNNING;
}

export function SystemHealthPanel({ report, locale }: { report: SystemHealthReport; locale: Locale }) {
  const text = healthText(locale);
  const activeQueueCount = queueActiveCount(report);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{text.overall}</p>
            <h2 className="mt-1 text-2xl font-semibold">{statusLabel(text, report.overallStatus)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {text.generatedAt}: {formatDateTime(locale, report.generatedAt)}
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
          status={report.directories.some((item) => item.status === "critical") ? "critical" : "ok"}
          icon={FolderCheck}
          text={text}
        />
        <SummaryCard
          title={text.queues}
          value={String(activeQueueCount)}
          status={report.queues.status}
          icon={Activity}
          text={text}
        />
        <SummaryCard
          title={text.security}
          value={String(report.security.activeAdminUsers)}
          status={report.security.status}
          icon={ShieldCheck}
          text={text}
        />
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
          <StatusPill
            status={report.directories.some((item) => item.status === "critical") ? "critical" : "ok"}
            text={text}
          />
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
          <DetailRow label={text.lastRun} value={formatDateTime(locale, report.backup.lastRunAt)} />
          <DetailRow label={text.lastStatus} value={report.backup.lastRunStatus || text.none} />
          <DetailRow label={text.failedLast7Days} value={String(report.backup.failedLast7Days)} />
          <DetailRow
            label={text.latestBackup}
            value={report.backup.latestBackup
              ? `${report.backup.latestBackup.filename} · ${formatSize(report.backup.latestBackup.sizeBytes)} · ${formatDateTime(locale, report.backup.latestBackup.createdAt)}`
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
          <DetailRow label="SMTP password" value={yesNo(text, report.mail.passwordConfigured)} />
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
