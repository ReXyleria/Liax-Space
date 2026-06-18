import type { ArticleLocale } from "../articles/articles.types.js";

export type MailTemplateKey = "guestbook.notification";

export type MailTemplate = {
  id: number;
  key: MailTemplateKey;
  locale: ArticleLocale;
  subject: string;
  bodyText: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MailLogStatus = "failed" | "skipped" | "success";

export type MailLog = {
  id: number;
  templateKey: string;
  recipient: string;
  subject: string;
  status: MailLogStatus;
  message: string | null;
  providerResponse: string | null;
  relatedType: string | null;
  relatedId: number | null;
  createdAt: Date;
};

export type UpsertMailTemplateInput = {
  key: MailTemplateKey;
  locale: ArticleLocale;
  subject: string;
  bodyText: string;
  enabled: boolean;
};

export type CreateMailLogInput = {
  templateKey: string;
  recipient: string;
  subject: string;
  status: MailLogStatus;
  message?: string | null;
  providerResponse?: string | null;
  relatedType?: string | null;
  relatedId?: number | null;
};
