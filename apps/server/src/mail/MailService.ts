import type { ArticleLocale } from "../articles/articles.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { logger } from "../common/logger.js";
import type { GuestbookEntry } from "../guestbook/guestbook.types.js";
import { SettingsRepository } from "../settings/SettingsRepository.js";
import type { SiteSettings } from "../settings/settings.types.js";
import { UserRepository } from "../users/UserRepository.js";
import { MailRepository } from "./MailRepository.js";
import { sendSmtpMail, type SmtpClientConfig, type SmtpEncryption } from "./SmtpClient.js";
import type { MailLog, MailTemplate, MailTemplateKey } from "./mail.types.js";

type RenderVariables = Record<string, string>;

type SmtpSettings = SmtpClientConfig & {
  from: string;
  fromName: string;
  notificationsEnabled: boolean;
};

const mailTemplateKeys: MailTemplateKey[] = ["guestbook.notification"];
const smtpEncryptionModes: SmtpEncryption[] = ["none", "ssl_tls", "starttls"];

function isMailTemplateKey(value: unknown): value is MailTemplateKey {
  return typeof value === "string" && mailTemplateKeys.includes(value as MailTemplateKey);
}

function isArticleLocale(value: unknown): value is ArticleLocale {
  return value === "zh-CN" || value === "en-US";
}

function readString(settings: SiteSettings, key: string): string {
  const value = settings[key];

  return typeof value === "string" ? value.trim() : "";
}

function readNumber(settings: SiteSettings, key: string, fallback: number): number {
  const value = settings[key];

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && Number.isInteger(Number(value))) {
    return Number(value);
  }

  return fallback;
}

function readBoolean(settings: SiteSettings, key: string, fallback: boolean): boolean {
  const value = settings[key];

  return typeof value === "boolean" ? value : fallback;
}

function readSmtpEncryption(settings: SiteSettings): SmtpEncryption {
  const value = settings["smtp.encryption"];

  return smtpEncryptionModes.includes(value as SmtpEncryption) ? value as SmtpEncryption : "starttls";
}

function readSmtpSettings(settings: SiteSettings): SmtpSettings {
  return {
    encryption: readSmtpEncryption(settings),
    from: readString(settings, "smtp.from"),
    fromName: readString(settings, "smtp.fromName"),
    host: readString(settings, "smtp.host"),
    notificationsEnabled: readBoolean(settings, "smtp.notificationsEnabled", true),
    pass: readString(settings, "smtp.pass"),
    port: readNumber(settings, "smtp.port", 587),
    user: readString(settings, "smtp.user")
  };
}

function renderTemplateText(template: string, variables: RenderVariables): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/gu, (_match, key: string) => variables[key] ?? "");
}

function sanitizeTemplateSubject(subject: string): string {
  return subject.replace(/[\r\n]+/gu, " ").trim();
}

function truncateLogValue(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function validationError(message: string): never {
  throw new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function validateTemplateInput(input: {
  bodyText: unknown;
  enabled: unknown;
  key: unknown;
  locale: unknown;
  subject: unknown;
}) {
  if (!isMailTemplateKey(input.key)) {
    validationError("Unknown mail template key.");
  }

  if (!isArticleLocale(input.locale)) {
    validationError("Mail template locale must be zh-CN or en-US.");
  }

  if (typeof input.subject !== "string" || !input.subject.trim() || input.subject.length > 255) {
    validationError("Mail template subject is required and must be 255 characters or fewer.");
  }

  if (typeof input.bodyText !== "string" || !input.bodyText.trim() || input.bodyText.length > 50000) {
    validationError("Mail template body is required and must be 50000 characters or fewer.");
  }

  if (typeof input.enabled !== "boolean") {
    validationError("Mail template enabled must be a boolean.");
  }

  return {
    bodyText: input.bodyText.trim(),
    enabled: input.enabled,
    key: input.key,
    locale: input.locale,
    subject: sanitizeTemplateSubject(input.subject)
  };
}

export class MailService {
  constructor(
    private readonly mailRepository = new MailRepository(),
    private readonly settingsRepository = new SettingsRepository(),
    private readonly userRepository = new UserRepository()
  ) {}

  async listTemplates(): Promise<MailTemplate[]> {
    return this.mailRepository.listTemplates();
  }

  async updateTemplate(input: {
    bodyText: unknown;
    enabled: unknown;
    key: unknown;
    locale: unknown;
    subject: unknown;
  }): Promise<MailTemplate> {
    return this.mailRepository.upsertTemplate(validateTemplateInput(input));
  }

  async listLogs(input: { limit?: number } = {}): Promise<MailLog[]> {
    return this.mailRepository.listLogs(input);
  }

  async sendGuestbookNotification(entry: GuestbookEntry): Promise<MailLog> {
    const settings = await this.settingsRepository.getSiteSettings();
    const smtp = readSmtpSettings(settings);
    const template = await this.mailRepository.findTemplate("guestbook.notification", entry.locale);
    const adminUser = await this.userRepository.findAdminUser();
    const recipient = adminUser?.email ?? "";
    const variables = this.buildGuestbookVariables(entry);
    const subject = template ? renderTemplateText(template.subject, variables) : "Guestbook notification";

    if (!smtp.notificationsEnabled) {
      return this.mailRepository.createLog({
        message: "SMTP notifications are disabled.",
        recipient,
        relatedId: entry.id,
        relatedType: "guestbook",
        status: "skipped",
        subject,
        templateKey: "guestbook.notification"
      });
    }

    if (!template || !template.enabled) {
      return this.mailRepository.createLog({
        message: "Mail template is missing or disabled.",
        recipient,
        relatedId: entry.id,
        relatedType: "guestbook",
        status: "skipped",
        subject,
        templateKey: "guestbook.notification"
      });
    }

    if (!recipient) {
      return this.mailRepository.createLog({
        message: "No administrator email is available.",
        recipient: "",
        relatedId: entry.id,
        relatedType: "guestbook",
        status: "skipped",
        subject,
        templateKey: template.key
      });
    }

    if (!smtp.host || !smtp.from || !smtp.port) {
      return this.mailRepository.createLog({
        message: "SMTP host, port, or sender is not configured.",
        recipient,
        relatedId: entry.id,
        relatedType: "guestbook",
        status: "skipped",
        subject,
        templateKey: template.key
      });
    }

    const body = renderTemplateText(template.bodyText, variables);

    try {
      const providerResponse = await sendSmtpMail(smtp, {
        from: smtp.from,
        fromName: smtp.fromName,
        subject,
        text: body,
        to: recipient
      });

      return this.mailRepository.createLog({
        providerResponse: truncateLogValue(providerResponse, 4000),
        recipient,
        relatedId: entry.id,
        relatedType: "guestbook",
        status: "success",
        subject,
        templateKey: template.key
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed.";
      logger.warn("mail delivery failed", {
        entryId: entry.id,
        message,
        templateKey: template.key
      });

      return this.mailRepository.createLog({
        message: truncateLogValue(message, 4000),
        recipient,
        relatedId: entry.id,
        relatedType: "guestbook",
        status: "failed",
        subject,
        templateKey: template.key
      });
    }
  }

  private buildGuestbookVariables(entry: GuestbookEntry): RenderVariables {
    const isZh = entry.locale === "zh-CN";

    return {
      adminUrl: "/console#guestbook",
      authorName: entry.authorName,
      content: entry.content,
      createdAt: entry.createdAt.toISOString(),
      email: entry.email ?? (isZh ? "未留邮箱" : "No email"),
      locale: entry.locale,
      visibility: entry.notifyOnly ? (isZh ? "私密留言" : "Private") : (isZh ? "公开留言" : "Public")
    };
  }
}
