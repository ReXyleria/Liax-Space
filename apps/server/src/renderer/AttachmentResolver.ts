import { AttachmentRepository } from "../attachments/AttachmentRepository.js";
import type { Attachment } from "../attachments/attachments.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import type { UsedAttachment } from "./renderer.types.js";

export type AttachmentResolutionResult = {
  markdown: string;
  usedAttachments: UsedAttachment[];
};

export interface AttachmentLookup {
  findById(id: number): Promise<Attachment | null>;
}

export interface AttachmentResolverLike {
  resolve(markdown: string): Promise<AttachmentResolutionResult>;
}

const attachmentReferencePattern = /attachment:\/\/([1-9]\d*)/g;

function attachmentError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

export class AttachmentResolver implements AttachmentResolverLike {
  constructor(private readonly attachmentRepository: AttachmentLookup = new AttachmentRepository()) {}

  extractAttachmentIds(markdown: string): number[] {
    const ids: number[] = [];
    const seenIds = new Set<number>();
    let match: RegExpExecArray | null;

    attachmentReferencePattern.lastIndex = 0;

    while ((match = attachmentReferencePattern.exec(markdown)) !== null) {
      const attachmentId = Number(match[1]);

      if (!seenIds.has(attachmentId)) {
        seenIds.add(attachmentId);
        ids.push(attachmentId);
      }
    }

    return ids;
  }

  async validateAttachmentReferences(markdown: string): Promise<number[]> {
    const attachmentIds = this.extractAttachmentIds(markdown);

    await Promise.all(attachmentIds.map((attachmentId) => this.requireExistingAttachment(attachmentId)));

    return attachmentIds;
  }

  async resolve(markdown: string): Promise<AttachmentResolutionResult> {
    const attachmentIds = this.extractAttachmentIds(markdown);

    if (attachmentIds.length === 0) {
      return {
        markdown,
        usedAttachments: []
      };
    }

    const attachments = await Promise.all(attachmentIds.map((attachmentId) => this.requireResolvableAttachment(attachmentId)));
    const publicUrlById = new Map(attachments.map((attachment) => [attachment.id, attachment.publicUrl]));
    attachmentReferencePattern.lastIndex = 0;
    const resolvedMarkdown = markdown.replace(attachmentReferencePattern, (reference, rawAttachmentId: string) => {
      const publicUrl = publicUrlById.get(Number(rawAttachmentId));

      return publicUrl ?? reference;
    });

    return {
      markdown: resolvedMarkdown,
      usedAttachments: attachments.map((attachment) => ({
        id: attachment.id,
        publicUrl: attachment.publicUrl
      }))
    };
  }

  private async requireExistingAttachment(attachmentId: number): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findById(attachmentId);

    if (!attachment || attachment.deletedAt !== null) {
      throw attachmentError(`Attachment not found: attachment://${attachmentId}.`);
    }

    return attachment;
  }

  private async requireResolvableAttachment(attachmentId: number): Promise<Attachment & { publicUrl: string }> {
    const attachment = await this.requireExistingAttachment(attachmentId);

    if (!attachment.publicUrl) {
      throw attachmentError(`Attachment public URL is missing: attachment://${attachmentId}.`);
    }

    return attachment as Attachment & { publicUrl: string };
  }
}
