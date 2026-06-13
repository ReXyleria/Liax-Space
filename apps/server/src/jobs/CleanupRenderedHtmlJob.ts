import { readdir, rm } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";

import { storagePaths } from "../config/paths.js";
import { getDatabasePool } from "../database/connection.js";
import type { ArticleVersionLocale } from "../versions/versions.types.js";

export type CleanupRenderedHtmlJobInput = {
  dryRun?: boolean;
};

export type CleanupRenderedHtmlCandidate = {
  htmlPath: string;
  absolutePath: string;
};

export type CleanupRenderedHtmlFailure = CleanupRenderedHtmlCandidate & {
  reason: string;
};

export type CleanupRenderedHtmlJobResult = {
  dryRun: boolean;
  candidateCount: number;
  deletedCount: number;
  failureCount: number;
  candidates: CleanupRenderedHtmlCandidate[];
  failures: CleanupRenderedHtmlFailure[];
};

type ProtectedHtmlRow = RowDataPacket & {
  html_path: string | null;
};

type PinnedVersionRow = RowDataPacket & {
  id: number;
  article_id: number;
  locale: ArticleVersionLocale;
  html_path: string | null;
};

function toStorageRelativePath(rootDir: string, absolutePath: string): string | null {
  const relativePath = relative(rootDir, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return relativePath.replace(/\\/g, "/");
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown cleanup failure.";
}

export class CleanupRenderedHtmlJob {
  async run(input: CleanupRenderedHtmlJobInput = {}): Promise<CleanupRenderedHtmlJobResult> {
    const dryRun = input.dryRun !== false;
    const protectedHtmlPaths = await this.listProtectedHtmlPaths();
    const existingHtmlFiles = await this.listRenderedHtmlFiles();
    const candidates = existingHtmlFiles.filter((file) => !protectedHtmlPaths.has(file.htmlPath));
    const failures: CleanupRenderedHtmlFailure[] = [];
    let deletedCount = 0;

    for (const candidate of candidates) {
      if (dryRun) {
        continue;
      }

      try {
        await rm(candidate.absolutePath, { force: true });
        await this.clearCleanedHtmlPath(candidate.htmlPath);
        deletedCount += 1;
      } catch (error) {
        failures.push({
          ...candidate,
          reason: errorReason(error)
        });
      }
    }

    return {
      candidateCount: candidates.length,
      candidates,
      deletedCount,
      dryRun,
      failureCount: failures.length,
      failures
    };
  }

  private async listProtectedHtmlPaths(): Promise<Set<string>> {
    const pool = getDatabasePool();
    const protectedPaths = new Set<string>();
    const [publishedRows] = await pool.execute<ProtectedHtmlRow[]>(
      `SELECT current_html_path AS html_path
       FROM article_translations
       INNER JOIN articles ON articles.id = article_translations.article_id
       WHERE published_version_id IS NOT NULL
         AND current_html_path IS NOT NULL
         AND published_at IS NOT NULL
         AND articles.deleted_at IS NULL`
    );
    const [pinnedRows] = await pool.execute<PinnedVersionRow[]>(
      `SELECT id, article_id, locale, html_path
       FROM article_versions
       WHERE is_pinned = TRUE`
    );

    for (const row of publishedRows) {
      if (row.html_path) {
        protectedPaths.add(row.html_path.replace(/\\/g, "/"));
      }
    }

    for (const row of pinnedRows) {
      protectedPaths.add(`${row.locale}/articles/${row.article_id}/${row.id}/index.html`);

      if (row.html_path) {
        protectedPaths.add(row.html_path.replace(/\\/g, "/"));
      }
    }

    return protectedPaths;
  }

  private async clearCleanedHtmlPath(htmlPath: string): Promise<void> {
    const pool = getDatabasePool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute(
        "UPDATE article_versions SET html_path = NULL WHERE html_path = ?",
        [htmlPath]
      );
      await connection.execute(
        `UPDATE article_translations
         SET published_version_id = NULL,
             current_html_path = NULL,
             published_at = NULL
         WHERE current_html_path = ?`,
        [htmlPath]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async listRenderedHtmlFiles(): Promise<CleanupRenderedHtmlCandidate[]> {
    const rootDir = resolve(storagePaths.renderedDir);
    const files = await this.walkHtmlFiles(rootDir);

    return files.flatMap((absolutePath) => {
      const htmlPath = toStorageRelativePath(rootDir, absolutePath);

      if (htmlPath === null) {
        return [];
      }

      return [{ absolutePath, htmlPath }];
    });
  }

  private async walkHtmlFiles(dirPath: string): Promise<string[]> {
    let entries: Dirent[];

    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      if (error !== null && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
        return [];
      }

      throw error;
    }

    const files: string[] = [];

    for (const entry of entries) {
      const absolutePath = resolve(dirPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...await this.walkHtmlFiles(absolutePath));
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".html")) {
        files.push(absolutePath);
        continue;
      }

      // Symlinks are skipped intentionally. Cleanup should only remove files owned by rendered storage.
    }

    return files;
  }
}
