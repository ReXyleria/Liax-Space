export type AttachmentMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type Attachment = {
  id: number;
  ownerId: number;
  originalFilename: string;
  storageKey: string;
  publicUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: Date;
  deletedAt: Date | null;
};

export type UploadedAttachmentFile = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

export type CreateAttachmentInput = {
  ownerId: number;
  originalFilename: string;
  storageKey: string;
  publicUrl?: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export type AttachmentUploadResult = {
  attachment: Attachment;
  markdown: string;
};

export type AttachmentListInput = {
  limit?: number;
  offset?: number;
  search?: string;
  unusedOnly?: boolean;
};
