import { httpClient } from "./httpClient";

export type Attachment = {
  id: number;
  ownerId: number;
  originalFilename: string;
  storageKey: string;
  publicUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  isUsed?: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type AttachmentUploadResult = {
  attachment: Attachment;
  markdown: string;
};

export type AvatarUploadResult = AttachmentUploadResult & {
  preferences: {
    avatar_attachment_id: number | null;
    avatar_public_url: string | null;
    locale: "zh-CN" | "en-US";
    reduced_motion: boolean;
  };
};

export const attachmentApi = {
  listAttachments(input: { search?: string; unusedOnly?: boolean } = {}): Promise<{ attachments: Attachment[] }> {
    const params = new URLSearchParams();

    if (input.search?.trim()) {
      params.set("search", input.search.trim());
    }

    if (input.unusedOnly) {
      params.set("unused", "1");
    }

    const query = params.toString();
    return httpClient.get<{ attachments: Attachment[] }>(query ? `/admin/attachments?${query}` : "/admin/attachments");
  },

  uploadAttachment(file: File): Promise<AttachmentUploadResult> {
    const body = new FormData();
    body.set("file", file);

    return httpClient.post<AttachmentUploadResult>("/admin/attachments", body);
  },

  uploadAvatar(file: File): Promise<AvatarUploadResult> {
    const body = new FormData();
    body.set("file", file);

    return httpClient.post<AvatarUploadResult>("/admin/me/avatar", body);
  },

  deleteAttachments(ids: number[]): Promise<{ deleted: number }> {
    return httpClient.delete<{ deleted: number }>("/admin/attachments", { ids });
  }
};
