import { MailTemplateScene } from "@prisma/client";
import { z } from "zod";

export const mailTemplateUpdateSchema = z.object({
  scene: z.nativeEnum(MailTemplateScene),
  subject: z.string().trim().min(1, "Subject is required.").max(200, "Subject is too long."),
  bodyHtml: z.string().trim().min(1, "HTML body is required.")
});
