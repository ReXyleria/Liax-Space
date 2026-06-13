import { readdir, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";

import { storagePaths } from "../config/paths.js";
import { getDatabasePool } from "../database/connection.js";

export type ConsistencyStatus = "OK" | "WARN" | "ERROR";

export type ConsistencyIssue = {
  severity: "WARN" | "ERROR";
  code: string;
  message: string;
  table?: string;
  id?: number;
  path?: string;
  details?: Record<string, string | number | null>;
};

export type ConsistencyCheckResult = {
  name: string;
  status: ConsistencyStatus;
  issueCount: number;
  issues: ConsistencyIssue[];
};

export type CheckConsistencyJobResult = {
  status: ConsistencyStatus;
  checkedAt: string;
  summary: {
    ok: number;
    warn: number;
    error: number;
  };
  checks: ConsistencyCheckResult[];
};

type MissingCurrentVersionRow = RowDataPacket & {
  translation_id: number;
  article_id: number;
  locale: string;
  current_version_id: number;
};

type MissingPublishedVersionRow = RowDataPacket & {
  translation_id: number;
  article_id: number;
  locale: string;
  published_version_id: number;
};

type TranslationHtmlPathRow = RowDataPacket & {
  translation_id: number;
  article_id: number;
  locale: string;
  current_html_path: string;
};

type VersionHtmlPathRow = RowDataPacket & {
  version_id: number;
  article_id: number;
  locale: string;
  html_path: string;
};

type AttachmentStorageRow = RowDataPacket & {
  attachment_id: number;
  storage_key: string;
};

type DbPathRow = RowDataPacket & {
  file_path: string | null;
};

function checkStatus(issues: ConsistencyIssue[]): ConsistencyStatus {
  if (issues.some((issue) => issue.severity === "ERROR")) {
    return "ERROR";
  }

  if (issues.some((issue) => issue.severity === "WARN")) {
    return "WARN";
  }

  return "OK";
}

function createCheck(name: string, issues: ConsistencyIssue[]): ConsistencyCheckResult {
  return {
    issueCount: issues.length,
    issues,
    name,
    status: checkStatus(issues)
  };
}

function summarize(checks: ConsistencyCheckResult[]): CheckConsistencyJobResult["summary"] {
  return checks.reduce(
    (summary, check) => {
      const key = check.status.toLowerCase() as Lowercase<ConsistencyStatus>;
      summary[key] += 1;
      return summary;
    },
    { error: 0, ok: 0, warn: 0 }
  );
}

function overallStatus(summary: CheckConsistencyJobResult["summary"]): ConsistencyStatus {
  if (summary.error > 0) {
    return "ERROR";
  }

  if (summary.warn > 0) {
    return "WARN";
  }

  return "OK";
}

function isNotFoundError(error: unknown): boolean {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(absolutePath);
    return fileStat.isFile();
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

function toStorageRelativePath(rootDir: string, absolutePath: string): string | null {
  const relativePath = relative(rootDir, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return relativePath.replace(/\\/g, "/");
}

function resolveInsideStorage(rootDir: string, storagePath: string): string | null {
  const absolutePath = resolve(rootDir, storagePath.replace(/\\/g, "/"));
  const relativePath = relative(rootDir, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

function normalizeUploadsStorageKey(storageKey: string): string {
  return storageKey.replace(/\\/g, "/").replace(/^uploads\//, "");
}

export class CheckConsistencyJob {
  async run(): Promise<CheckConsistencyJobResult> {
    const checks = [
      await this.checkCurrentVersionPointers(),
      await this.checkPublishedVersionPointers(),
      await this.checkCurrentHtmlFiles(),
      await this.checkVersionHtmlFiles(),
      await this.checkAttachmentFiles(),
      await this.checkUnrecordedRenderedFiles(),
      await this.checkUnrecordedUploadFiles()
    ];
    const summary = summarize(checks);

    return {
      checkedAt: new Date().toISOString(),
      checks,
      status: overallStatus(summary),
      summary
    };
  }

  private async checkCurrentVersionPointers(): Promise<ConsistencyCheckResult> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<MissingCurrentVersionRow[]>(
      `SELECT
         article_translations.id AS translation_id,
         article_translations.article_id,
         article_translations.locale,
         article_translations.current_version_id
       FROM article_translations
       LEFT JOIN article_versions
         ON article_versions.id = article_translations.current_version_id
        AND article_versions.article_id = article_translations.article_id
        AND article_versions.locale = article_translations.locale
       WHERE article_translations.current_version_id IS NOT NULL
         AND article_versions.id IS NULL`
    );

    return createCheck("article_translations.current_version_id", rows.map((row) => ({
      code: "ARTICLE_TRANSLATION_CURRENT_VERSION_MISSING",
      details: {
        articleId: row.article_id,
        currentVersionId: row.current_version_id,
        locale: row.locale
      },
      id: row.translation_id,
      message: "article_translations.current_version_id does not point to an existing version for the same article and locale.",
      severity: "ERROR",
      table: "article_translations"
    })));
  }

  private async checkPublishedVersionPointers(): Promise<ConsistencyCheckResult> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<MissingPublishedVersionRow[]>(
      `SELECT
         article_translations.id AS translation_id,
         article_translations.article_id,
         article_translations.locale,
         article_translations.published_version_id
       FROM article_translations
       LEFT JOIN article_versions
         ON article_versions.id = article_translations.published_version_id
        AND article_versions.article_id = article_translations.article_id
        AND article_versions.locale = article_translations.locale
       WHERE article_translations.published_version_id IS NOT NULL
         AND article_versions.id IS NULL`
    );

    return createCheck("article_translations.published_version_id", rows.map((row) => ({
      code: "ARTICLE_TRANSLATION_PUBLISHED_VERSION_MISSING",
      details: {
        articleId: row.article_id,
        locale: row.locale,
        publishedVersionId: row.published_version_id
      },
      id: row.translation_id,
      message: "article_translations.published_version_id does not point to an existing version for the same article and locale.",
      severity: "ERROR",
      table: "article_translations"
    })));
  }

  private async checkCurrentHtmlFiles(): Promise<ConsistencyCheckResult> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<TranslationHtmlPathRow[]>(
      `SELECT
         id AS translation_id,
         article_id,
         locale,
         current_html_path
       FROM article_translations
       WHERE current_html_path IS NOT NULL`
    );
    const issues: ConsistencyIssue[] = [];
    const renderedRoot = resolve(storagePaths.renderedDir);

    for (const row of rows) {
      const absolutePath = resolveInsideStorage(renderedRoot, row.current_html_path);

      if (absolutePath === null) {
        issues.push({
          code: "ARTICLE_TRANSLATION_CURRENT_HTML_PATH_UNSAFE",
          details: {
            articleId: row.article_id,
            locale: row.locale
          },
          id: row.translation_id,
          message: "article_translations.current_html_path resolves outside storage/rendered.",
          path: row.current_html_path,
          severity: "ERROR",
          table: "article_translations"
        });
        continue;
      }

      if (!await fileExists(absolutePath)) {
        issues.push({
          code: "ARTICLE_TRANSLATION_CURRENT_HTML_FILE_MISSING",
          details: {
            articleId: row.article_id,
            locale: row.locale
          },
          id: row.translation_id,
          message: "article_translations.current_html_path points to a missing rendered HTML file.",
          path: row.current_html_path,
          severity: "ERROR",
          table: "article_translations"
        });
      }
    }

    return createCheck("article_translations.current_html_path", issues);
  }

  private async checkVersionHtmlFiles(): Promise<ConsistencyCheckResult> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<VersionHtmlPathRow[]>(
      `SELECT
         id AS version_id,
         article_id,
         locale,
         html_path
       FROM article_versions
       WHERE html_path IS NOT NULL`
    );
    const issues: ConsistencyIssue[] = [];
    const renderedRoot = resolve(storagePaths.renderedDir);

    for (const row of rows) {
      const absolutePath = resolveInsideStorage(renderedRoot, row.html_path);

      if (absolutePath === null) {
        issues.push({
          code: "ARTICLE_VERSION_HTML_PATH_UNSAFE",
          details: {
            articleId: row.article_id,
            locale: row.locale
          },
          id: row.version_id,
          message: "article_versions.html_path resolves outside storage/rendered.",
          path: row.html_path,
          severity: "ERROR",
          table: "article_versions"
        });
        continue;
      }

      if (!await fileExists(absolutePath)) {
        issues.push({
          code: "ARTICLE_VERSION_HTML_FILE_MISSING",
          details: {
            articleId: row.article_id,
            locale: row.locale
          },
          id: row.version_id,
          message: "article_versions.html_path points to a missing rendered HTML file.",
          path: row.html_path,
          severity: "WARN",
          table: "article_versions"
        });
      }
    }

    return createCheck("article_versions.html_path", issues);
  }

  private async checkAttachmentFiles(): Promise<ConsistencyCheckResult> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<AttachmentStorageRow[]>(
      `SELECT
         id AS attachment_id,
         storage_key
       FROM attachments
       WHERE deleted_at IS NULL`
    );
    const issues: ConsistencyIssue[] = [];
    const uploadsRoot = resolve(storagePaths.uploadsDir);

    for (const row of rows) {
      const relativeStoragePath = normalizeUploadsStorageKey(row.storage_key);
      const absolutePath = resolveInsideStorage(uploadsRoot, relativeStoragePath);

      if (absolutePath === null) {
        issues.push({
          code: "ATTACHMENT_STORAGE_KEY_UNSAFE",
          id: row.attachment_id,
          message: "attachments.storage_key resolves outside storage/uploads.",
          path: row.storage_key,
          severity: "ERROR",
          table: "attachments"
        });
        continue;
      }

      if (!await fileExists(absolutePath)) {
        issues.push({
          code: "ATTACHMENT_FILE_MISSING",
          id: row.attachment_id,
          message: "attachments.storage_key points to a missing uploaded source file.",
          path: row.storage_key,
          severity: "ERROR",
          table: "attachments"
        });
      }
    }

    return createCheck("attachments.storage_key", issues);
  }

  private async checkUnrecordedRenderedFiles(): Promise<ConsistencyCheckResult> {
    const renderedRoot = resolve(storagePaths.renderedDir);
    const files = await this.walkFiles(renderedRoot);
    const recordedPaths = await this.listRecordedRenderedPaths();
    const issues = files.flatMap((absolutePath) => {
      const relativePath = toStorageRelativePath(renderedRoot, absolutePath);

      if (relativePath === null || recordedPaths.has(relativePath)) {
        return [];
      }

      return [{
        code: "UNRECORDED_RENDERED_FILE",
        message: "storage/rendered contains a file that is not referenced by article_translations.current_html_path or article_versions.html_path.",
        path: relativePath,
        severity: "WARN" as const
      }];
    });

    return createCheck("storage/rendered unrecorded files", issues);
  }

  private async checkUnrecordedUploadFiles(): Promise<ConsistencyCheckResult> {
    const uploadsRoot = resolve(storagePaths.uploadsDir);
    const files = await this.walkFiles(uploadsRoot);
    const recordedPaths = await this.listRecordedUploadPaths();
    const issues = files.flatMap((absolutePath) => {
      const relativePath = toStorageRelativePath(uploadsRoot, absolutePath);

      if (relativePath === null || recordedPaths.has(relativePath)) {
        return [];
      }

      return [{
        code: "UNRECORDED_UPLOAD_FILE",
        message: "storage/uploads contains a file that is not referenced by attachments.storage_key.",
        path: relativePath,
        severity: "WARN" as const
      }];
    });

    return createCheck("storage/uploads unrecorded files", issues);
  }

  private async listRecordedRenderedPaths(): Promise<Set<string>> {
    const pool = getDatabasePool();
    const [translationRows] = await pool.execute<DbPathRow[]>(
      `SELECT current_html_path AS file_path
       FROM article_translations
       WHERE current_html_path IS NOT NULL`
    );
    const [versionRows] = await pool.execute<DbPathRow[]>(
      `SELECT html_path AS file_path
       FROM article_versions
       WHERE html_path IS NOT NULL`
    );

    return new Set(
      [...translationRows, ...versionRows]
        .flatMap((row) => row.file_path ? [row.file_path.replace(/\\/g, "/")] : [])
    );
  }

  private async listRecordedUploadPaths(): Promise<Set<string>> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<DbPathRow[]>(
      `SELECT storage_key AS file_path
       FROM attachments
       WHERE deleted_at IS NULL`
    );

    return new Set(
      rows.flatMap((row) => row.file_path ? [normalizeUploadsStorageKey(row.file_path)] : [])
    );
  }

  private async walkFiles(dirPath: string): Promise<string[]> {
    let entries: Dirent[];

    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }

      throw error;
    }

    const files: string[] = [];

    for (const entry of entries) {
      if (entry.name === ".gitkeep") {
        continue;
      }

      const absolutePath = resolve(dirPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...await this.walkFiles(absolutePath));
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
        continue;
      }

      // Symlinks are skipped intentionally. Consistency checks only inspect files owned by storage.
    }

    return files;
  }
}
