import type { Attachment } from "../api/attachmentApi";

export type AttachmentPageLoader = (input: {
  limit?: number;
  offset?: number;
}) => Promise<{ attachments: Attachment[] }>;

export type AttachmentPreviewLoadOptions = {
  maxPages?: number;
  pageSize?: number;
};

const defaultPageSize = 100;
const defaultMaxPages = 50;

export function buildAttachmentPreviewUrls(attachments: Attachment[]): Record<string, string> {
  const previewUrls: Record<string, string> = {};

  for (const attachment of attachments) {
    if (!attachment.publicUrl || !attachment.mimeType.startsWith("image/")) {
      continue;
    }

    previewUrls[String(attachment.id)] = attachment.publicUrl;
    previewUrls[`attachment://${attachment.id}`] = attachment.publicUrl;
  }

  return previewUrls;
}

export function extractAttachmentIdsFromMarkdown(markdown: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const match of markdown.matchAll(/attachment:\/\/(\d+)/gu)) {
    const id = Number(match[1]);

    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
      continue;
    }

    ids.push(id);
    seen.add(id);
  }

  return ids;
}

export async function loadAttachmentPreviewUrlsForMarkdown(
  markdown: string,
  loadPage: AttachmentPageLoader,
  options: AttachmentPreviewLoadOptions = {}
): Promise<Record<string, string>> {
  const neededIds = new Set(extractAttachmentIdsFromMarkdown(markdown));
  const previewUrls: Record<string, string> = {};

  if (neededIds.size === 0) {
    return previewUrls;
  }

  const pageSize = Math.max(1, Math.trunc(options.pageSize ?? defaultPageSize));
  const maxPages = Math.max(1, Math.trunc(options.maxPages ?? defaultMaxPages));

  for (let page = 0; page < maxPages && neededIds.size > 0; page += 1) {
    const attachments = (await loadPage({ limit: pageSize, offset: page * pageSize })).attachments;
    const pagePreviewUrls = buildAttachmentPreviewUrls(attachments);

    Object.assign(previewUrls, pagePreviewUrls);

    for (const attachment of attachments) {
      if (attachment.publicUrl && attachment.mimeType.startsWith("image/")) {
        neededIds.delete(attachment.id);
      }
    }

    if (attachments.length < pageSize) {
      break;
    }
  }

  return previewUrls;
}
