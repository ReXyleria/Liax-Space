import {
  ArticleTranslationJobStatus,
  BackupStatus,
  PublicContentTranslationJobStatus
} from "@prisma/client";

export type SystemHealthStatus = "ok" | "warning" | "critical";

export type RuntimeDirectoryHealth = {
  key: "storage" | "uploads" | "backups";
  path: string;
  exists: boolean;
  writable: boolean;
  entries: number | null;
  status: SystemHealthStatus;
  error?: string;
};

export type QueueHealth = {
  status: SystemHealthStatus;
  article: Record<ArticleTranslationJobStatus, number> & { failedLast24Hours: number; staleRunning: number };
  publicContent: Record<PublicContentTranslationJobStatus, number> & { failedLast24Hours: number; staleRunning: number };
  error?: string;
};

export type SystemHealthReport = {
  generatedAt: Date;
  overallStatus: SystemHealthStatus;
  runtime: {
    nodeEnv: string;
    nodeVersion: string;
    timezone: string;
    workerMode: string;
    workerRole: string;
    inProcessWorkersEnabled: boolean;
  };
  database: {
    status: SystemHealthStatus;
    configured: boolean;
    source: string;
    host?: string;
    port?: string;
    database?: string;
    user?: string;
    missingMysqlEnv: string[];
    latencyMs: number | null;
    error?: string;
  };
  directories: RuntimeDirectoryHealth[];
  backup: {
    status: SystemHealthStatus;
    scheduleEnabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    time: string;
    retentionDays: number;
    lastRunAt: Date | null;
    lastRunStatus: string;
    latestBackup: {
      filename: string;
      sizeBytes: number;
      status: BackupStatus;
      createdAt: Date;
      error: string | null;
    } | null;
    failedLast7Days: number;
    error?: string;
  };
  queues: QueueHealth;
  mail: {
    status: SystemHealthStatus;
    notificationsEnabled: boolean;
    ready: boolean;
    source: "environment" | "settings" | "none";
    hostConfigured: boolean;
    fromConfigured: boolean;
    userConfigured: boolean;
    passwordConfigured: boolean;
    failedLast24Hours: number;
    skippedLast24Hours: number;
    error?: string;
  };
  security: {
    status: SystemHealthStatus;
    activeAdminUsers: number;
    disabledAdminUsers: number;
    activeSessions: number;
    trustedDevices: number;
    smtpFailOpenLast24Hours: number;
    recentLoginEvents: number;
    error?: string;
  };
};
