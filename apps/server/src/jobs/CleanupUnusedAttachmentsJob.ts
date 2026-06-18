import { rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";

import { storagePaths } from "../config/paths.js";
import { getDatabasePool } from "../database/connection.js";

export type CleanupUnusedAttachmentsJobInput = {
  dryRun?: boolean;
  now?: Date;
};

export type CleanupAttachmentCandidate = {
  attachmentIds: number[];
  storageKey: string;
  absolutePath: string;
  createdAt: Date;
};

export type CleanupAttachmentFailure = CleanupAttachmentCandidate & {
  reason: string;
};

export type CleanupUnusedAttachmentsJobResult = {
  dryRun: boolean;
  cutoff: Date;
  candidateCount: number;
  deletedCount: number;
  failureCount: number;
  candidates: CleanupAttachmentCandidate[];
  failures: CleanupAttachmentFailure[];
};

type AttachmentCleanupRow = RowDataPacket & {
  id: number;
  storage_key: string;
  created_at: Date;
};

export type AttachmentCleanupSource = {
  id: number;
  storageKey: string;
  createdAt: Date;
};

const retentionMs = 24 * 60 * 60 * 1000;

export const unusedAttachmentCleanupQuery = `SELECT id, storage_key, created_at
       FROM attachments
       WHERE deleted_at IS NULL
         AND created_at < ?
         AND NOT EXISTS (
           SELECT 1
           FROM attachments referenced_attachment
           INNER JOIN article_version_attachments
             ON article_version_attachments.attachment_id = referenced_attachment.id
           WHERE referenced_attachment.deleted_at IS NULL
             AND referenced_attachment.storage_key = attachments.storage_key
         )
         AND NOT EXISTS (
           SELECT 1
           FROM attachments referenced_avatar
           INNER JOIN user_preferences
             ON user_preferences.avatar_attachment_id = referenced_avatar.id
           WHERE referenced_avatar.deleted_at IS NULL
             AND referenced_avatar.storage_key = attachments.storage_key
         )
         AND NOT EXISTS (
           SELECT 1
           FROM site_settings
           WHERE site_settings.\`key\` = 'site.logoUrl'
             AND JSON_UNQUOTE(site_settings.value_json) = attachments.public_url
         )
         AND NOT EXISTS (
           SELECT 1
           FROM moments
           WHERE moments.deleted_at IS NULL
             AND attachments.public_url IS NOT NULL
             AND JSON_CONTAINS(moments.images_json, JSON_QUOTE(attachments.public_url))
         )
       ORDER BY created_at ASC, id ASC`;

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown cleanup failure.";
}

function storageKeyToRelativeUploadsPath(storageKey: string): string {
  return storageKey.replace(/\\/g, "/").replace(/^uploads\//, "");
}

function resolveInsideUploadsDir(storageKey: string): string | null {
  const uploadsRoot = resolve(storagePaths.uploadsDir);
  const absolutePath = resolve(uploadsRoot, storageKeyToRelativeUploadsPath(storageKey));
  const relativePath = relative(uploadsRoot, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

export function buildAttachmentCleanupCandidates(rows: AttachmentCleanupSource[]): CleanupAttachmentCandidate[] {
  const candidatesByPath = new Map<string, CleanupAttachmentCandidate>();

  for (const row of rows) {
    const absolutePath = resolveInsideUploadsDir(row.storageKey);

    if (absolutePath === null) {
      continue;
    }

    const existingCandidate = candidatesByPath.get(absolutePath);

    if (existingCandidate) {
      existingCandidate.attachmentIds.push(row.id);

      if (row.createdAt < existingCandidate.createdAt) {
        existingCandidate.createdAt = row.createdAt;
        existingCandidate.storageKey = row.storageKey;
      }

      continue;
    }

    candidatesByPath.set(absolutePath, {
      absolutePath,
      attachmentIds: [row.id],
      createdAt: row.createdAt,
      storageKey: row.storageKey
    });
  }

  return [...candidatesByPath.values()];
}

export class CleanupUnusedAttachmentsJob {
  async run(input: CleanupUnusedAttachmentsJobInput = {}): Promise<CleanupUnusedAttachmentsJobResult> {
    const dryRun = input.dryRun !== false;
    const now = input.now ?? new Date();
    const cutoff = new Date(now.getTime() - retentionMs);
    const candidates = await this.listCandidates(cutoff);
    const failures: CleanupAttachmentFailure[] = [];
    let deletedCount = 0;

    for (const candidate of candidates) {
      if (dryRun) {
        continue;
      }

      try {
        await rm(candidate.absolutePath, { force: true });
        deletedCount += await this.markAttachmentsDeleted(candidate.attachmentIds);
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
      cutoff,
      deletedCount,
      dryRun,
      failureCount: failures.length,
      failures
    };
  }

  private async listCandidates(cutoff: Date): Promise<CleanupAttachmentCandidate[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<AttachmentCleanupRow[]>(unusedAttachmentCleanupQuery, [cutoff]);

    return buildAttachmentCleanupCandidates(rows.map((row) => ({
      createdAt: row.created_at,
      id: row.id,
      storageKey: row.storage_key
    })));
  }

  private async markAttachmentsDeleted(attachmentIds: number[]): Promise<number> {
    if (attachmentIds.length === 0) {
      return 0;
    }

    const pool = getDatabasePool();
    const placeholders = attachmentIds.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `UPDATE attachments
       SET deleted_at = ?
       WHERE id IN (${placeholders})
         AND deleted_at IS NULL`,
      [
        new Date(),
        ...attachmentIds
      ]
    );

    return Number("affectedRows" in result ? result.affectedRows : 0);
  }
}
