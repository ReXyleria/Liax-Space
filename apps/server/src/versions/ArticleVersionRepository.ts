import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type {
  ArticleVersion,
  ArticleVersionLocale,
  CreateArticleVersionInput,
  FindVersionsForCleanupInput,
  ReplaceVersionAttachmentsInput,
  UpdateHtmlPathInput,
  UpdatePublishedRenderResultInput,
  UpdateRenderStatusInput
} from "./versions.types.js";

type ArticleVersionRow = RowDataPacket & {
  id: number;
  article_id: number;
  locale: ArticleVersionLocale;
  version_no: number;
  md_content: string;
  content_hash: string;
  render_hash: string | null;
  html_path: string | null;
  render_status: string;
  renderer_version: string | null;
  template_version: string | null;
  custom_rule_version: string | null;
  created_by: number;
  created_at: Date;
  is_published_snapshot: number | boolean;
  is_pinned: number | boolean;
};

const versionColumns = [
  "id",
  "article_id",
  "locale",
  "version_no",
  "md_content",
  "content_hash",
  "render_hash",
  "html_path",
  "render_status",
  "renderer_version",
  "template_version",
  "custom_rule_version",
  "created_by",
  "created_at",
  "is_published_snapshot",
  "is_pinned"
].join(", ");

function mapArticleVersionRow(row: ArticleVersionRow): ArticleVersion {
  return {
    id: row.id,
    articleId: row.article_id,
    locale: row.locale,
    versionNo: row.version_no,
    mdContent: row.md_content,
    contentHash: row.content_hash,
    renderHash: row.render_hash,
    htmlPath: row.html_path,
    renderStatus: row.render_status,
    rendererVersion: row.renderer_version,
    templateVersion: row.template_version,
    customRuleVersion: row.custom_rule_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    isPublishedSnapshot: Boolean(row.is_published_snapshot),
    isPinned: Boolean(row.is_pinned)
  };
}

export class ArticleVersionRepository {
  async createVersion(input: CreateArticleVersionInput): Promise<ArticleVersion> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO article_versions
        (article_id, locale, version_no, md_content, content_hash, render_hash, html_path, render_status,
         renderer_version, template_version, custom_rule_version, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.articleId,
        input.locale,
        input.versionNo,
        input.mdContent,
        input.contentHash,
        input.renderHash ?? null,
        input.htmlPath ?? null,
        input.renderStatus ?? "pending",
        input.rendererVersion ?? null,
        input.templateVersion ?? null,
        input.customRuleVersion ?? null,
        input.createdBy
      ]
    );

    const version = await this.findById(result.insertId);

    if (!version) {
      throw new Error("Created article version could not be loaded.");
    }

    return version;
  }

  async findById(id: number): Promise<ArticleVersion | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<ArticleVersionRow[]>(
      `SELECT ${versionColumns} FROM article_versions WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0] ? mapArticleVersionRow(rows[0]) : null;
  }

  async findLatestByArticleAndLocale(articleId: number, locale: ArticleVersionLocale): Promise<ArticleVersion | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<ArticleVersionRow[]>(
      `SELECT ${versionColumns}
       FROM article_versions
       WHERE article_id = ? AND locale = ?
       ORDER BY version_no DESC
       LIMIT 1`,
      [articleId, locale]
    );

    return rows[0] ? mapArticleVersionRow(rows[0]) : null;
  }

  async listByArticleAndLocale(articleId: number, locale: ArticleVersionLocale): Promise<ArticleVersion[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<ArticleVersionRow[]>(
      `SELECT ${versionColumns}
       FROM article_versions
       WHERE article_id = ? AND locale = ?
       ORDER BY version_no DESC`,
      [articleId, locale]
    );

    return rows.map(mapArticleVersionRow);
  }

  async getNextVersionNo(articleId: number, locale: ArticleVersionLocale): Promise<number> {
    const latestVersion = await this.findLatestByArticleAndLocale(articleId, locale);

    return latestVersion ? latestVersion.versionNo + 1 : 1;
  }

  async updateRenderStatus(input: UpdateRenderStatusInput): Promise<ArticleVersion | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE article_versions SET render_status = ?, render_hash = ? WHERE id = ?", [
      input.renderStatus,
      input.renderHash ?? null,
      input.versionId
    ]);

    return this.findById(input.versionId);
  }

  async updateHtmlPath(input: UpdateHtmlPathInput): Promise<ArticleVersion | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE article_versions SET html_path = ? WHERE id = ?", [input.htmlPath, input.versionId]);

    return this.findById(input.versionId);
  }

  async markPublishedSnapshot(versionId: number, isPublishedSnapshot = true): Promise<ArticleVersion | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE article_versions SET is_published_snapshot = ? WHERE id = ?", [
      isPublishedSnapshot,
      versionId
    ]);

    return this.findById(versionId);
  }

  async updatePublishedRenderResult(input: UpdatePublishedRenderResultInput): Promise<ArticleVersion | null> {
    const pool = getDatabasePool();
    await pool.execute(
      `UPDATE article_versions
       SET render_status = 'success',
           render_hash = ?,
           html_path = ?,
           renderer_version = ?,
           template_version = ?,
           custom_rule_version = ?,
           is_published_snapshot = TRUE
       WHERE id = ?`,
      [
        input.renderHash,
        input.htmlPath,
        input.rendererVersion,
        input.templateVersion,
        input.customRuleVersion,
        input.versionId
      ]
    );

    return this.findById(input.versionId);
  }

  async replaceVersionAttachments(input: ReplaceVersionAttachmentsInput): Promise<void> {
    const pool = getDatabasePool();
    const uniqueAttachmentIds = [...new Set(input.attachmentIds)];

    await pool.execute("DELETE FROM article_version_attachments WHERE article_version_id = ?", [input.versionId]);

    if (uniqueAttachmentIds.length === 0) {
      return;
    }

    const placeholders = uniqueAttachmentIds.map(() => "(?, ?)").join(", ");
    const params = uniqueAttachmentIds.flatMap((attachmentId) => [input.versionId, attachmentId]);

    await pool.execute(
      `INSERT INTO article_version_attachments (article_version_id, attachment_id) VALUES ${placeholders}`,
      params
    );
  }

  async pinVersion(versionId: number): Promise<ArticleVersion | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE article_versions SET is_pinned = TRUE WHERE id = ?", [versionId]);

    return this.findById(versionId);
  }

  async unpinVersion(versionId: number): Promise<ArticleVersion | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE article_versions SET is_pinned = FALSE WHERE id = ?", [versionId]);

    return this.findById(versionId);
  }

  async findVersionsForCleanup(input: FindVersionsForCleanupInput): Promise<ArticleVersion[]> {
    const pool = getDatabasePool();
    const keepLatest = Math.max(0, input.keepLatest);
    const limit = input.limit ?? 100;
    const [rows] = await pool.execute<ArticleVersionRow[]>(
      `SELECT ${versionColumns}
       FROM article_versions
       WHERE article_id = ?
         AND locale = ?
         AND is_published_snapshot = FALSE
         AND is_pinned = FALSE
         AND version_no NOT IN (
           SELECT version_no FROM (
             SELECT version_no
             FROM article_versions
             WHERE article_id = ? AND locale = ?
             ORDER BY version_no DESC
             LIMIT ?
           ) latest_versions
         )
       ORDER BY version_no ASC
       LIMIT ?`,
      [input.articleId, input.locale, input.articleId, input.locale, keepLatest, limit]
    );

    return rows.map(mapArticleVersionRow);
  }
}
