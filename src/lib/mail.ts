import { MailSendStatus, MailTemplateScene as DbMailTemplateScene } from "@prisma/client";
import nodemailer from "nodemailer";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import {
  mailDbSceneToDefinition,
  mailSceneKeyToDbScene,
  sampleVariables
} from "@/features/mail/templates";
import { getSiteConfig } from "@/lib/site";

export type MailResult =
  | { ok: true }
  | { ok: false; reason: "SMTP_NOT_CONFIGURED" | "SEND_FAILED" | "DISABLED"; message: string };

export type MailTemplateScene =
  | "registerCode"
  | "commentReply"
  | "momentComment"
  | "guestbookReply"
  | "loginAlert"
  | "passwordChanged"
  | "emailVerify"
  | "passwordReset"
  | "pageComment"
  | "articleComment";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

type TemplateOverride = {
  subject: string;
  bodyHtml: string;
};

const smtpKeys = ["smtp.host", "smtp.port", "smtp.user", "smtp.pass", "smtp.from"];

const legacySceneMap: Partial<Record<MailTemplateScene, DbMailTemplateScene>> = {
  registerCode: DbMailTemplateScene.REGISTER_CODE,
  commentReply: DbMailTemplateScene.COMMENT_REPLY,
  momentComment: DbMailTemplateScene.MOMENT_COMMENT,
  guestbookReply: DbMailTemplateScene.GUESTBOOK_REPLY,
  loginAlert: DbMailTemplateScene.LOGIN_ALERT,
  passwordChanged: DbMailTemplateScene.PASSWORD_RESET,
  emailVerify: DbMailTemplateScene.EMAIL_VERIFY,
  passwordReset: DbMailTemplateScene.PASSWORD_RESET,
  pageComment: DbMailTemplateScene.CUSTOM_PAGE_COMMENT,
  articleComment: DbMailTemplateScene.ARTICLE_COMMENT
};

function completeConfig(values: Record<string, string | undefined>): SmtpConfig | null {
  const host = values["smtp.host"]?.trim();
  const user = values["smtp.user"]?.trim();
  const pass = values["smtp.pass"];
  const from = (values["smtp.from"] || user)?.trim();
  const port = Number(values["smtp.port"] || 587);

  if (!host || !user || !pass || !from || !Number.isFinite(port)) {
    return null;
  }

  return { host, port, user, pass, from };
}

async function getSettingsValues(keys: string[]) {
  if (!isDatabaseConfigured()) {
    return {};
  }

  return withDatabase(async () => {
    const rows = await db.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true }
    });

    return Object.fromEntries(rows.map((row) => [row.key, row.value])) as Record<string, string>;
  }, {});
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const envConfig = completeConfig({
    "smtp.host": process.env.SMTP_HOST,
    "smtp.port": process.env.SMTP_PORT,
    "smtp.user": process.env.SMTP_USER,
    "smtp.pass": process.env.SMTP_PASS,
    "smtp.from": process.env.SMTP_FROM
  });

  if (envConfig) {
    return envConfig;
  }

  return completeConfig(await getSettingsValues(smtpKeys));
}

function resolveScene(scene: MailTemplateScene | DbMailTemplateScene) {
  if (Object.values(DbMailTemplateScene).includes(scene as DbMailTemplateScene)) {
    return scene as DbMailTemplateScene;
  }

  const resolved = legacySceneMap[scene as MailTemplateScene] ?? mailSceneKeyToDbScene[scene as string];
  if (!resolved) {
    throw new Error(`Unknown mail template scene: ${scene}`);
  }
  return resolved;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template
    .replace(/\$\{([a-zA-Z0-9_.]+)\}/g, (_, key: string) => escapeHtml(variables[key] ?? ""))
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => escapeHtml(variables[key] ?? ""));
}

function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function getTemplate(scene: DbMailTemplateScene) {
  const definition = mailDbSceneToDefinition.get(scene);
  if (!definition) {
    throw new Error(`No default mail template for scene ${scene}.`);
  }

  if (!isDatabaseConfigured()) {
    return {
      subject: definition.subject,
      bodyHtml: definition.bodyHtml
    };
  }

  const template = await db.mailTemplate.findUnique({ where: { scene } });
  return {
    subject: template?.subject ?? definition.subject,
    bodyHtml: template?.bodyHtml ?? definition.bodyHtml
  };
}

async function getBaseVariables() {
  const site = await getSiteConfig();

  return {
    ...sampleVariables(),
    "site.title": site.title,
    "site.url": site.url,
    siteName: site.title
  };
}

async function recordMailLog({
  scene,
  to,
  subject,
  status,
  error
}: {
  scene: DbMailTemplateScene;
  to: string;
  subject?: string;
  status: MailSendStatus;
  error?: string;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  await db.mailSendLog.create({
    data: {
      scene,
      to,
      subject,
      status,
      error
    }
  }).catch((logError) => {
    console.error("Failed to record mail log", logError);
  });
}

export async function sendTemplatedMail({
  to,
  scene,
  variables,
  respectNotificationToggle = true,
  templateOverride
}: {
  to: string;
  scene: MailTemplateScene | DbMailTemplateScene;
  variables: Record<string, string>;
  respectNotificationToggle?: boolean;
  templateOverride?: TemplateOverride;
}): Promise<MailResult> {
  const dbScene = resolveScene(scene);
  const baseVariables = await getBaseVariables();
  const template = templateOverride ?? await getTemplate(dbScene);
  const nextVariables = { ...baseVariables, ...variables };
  const subject = renderTemplate(template.subject, nextVariables);
  const html = renderTemplate(template.bodyHtml, nextVariables);
  const text = htmlToText(html);

  if (respectNotificationToggle) {
    const settings = await getSettingsValues(["smtp.notificationsEnabled"]);
    if (settings["smtp.notificationsEnabled"] === "false") {
      await recordMailLog({ scene: dbScene, to, subject, status: MailSendStatus.SKIPPED, error: "Notifications disabled." });
      return { ok: false, reason: "DISABLED", message: "Mail notifications are disabled." };
    }
  }

  const config = await getSmtpConfig();

  if (!config) {
    await recordMailLog({ scene: dbScene, to, subject, status: MailSendStatus.FAILED, error: "SMTP is not configured." });
    return {
      ok: false,
      reason: "SMTP_NOT_CONFIGURED",
      message: "SMTP is not configured. Configure SMTP host, port, user, password, and from address first."
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });

    await transporter.sendMail({
      to,
      from: config.from,
      subject,
      text,
      html
    });

    await recordMailLog({ scene: dbScene, to, subject, status: MailSendStatus.SENT });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed.";
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to send email", error);
    }
    await recordMailLog({ scene: dbScene, to, subject, status: MailSendStatus.FAILED, error: message });
    return {
      ok: false,
      reason: "SEND_FAILED",
      message: "Email send failed. Check SMTP configuration."
    };
  }
}

export async function sendVerificationCodeMail(email: string, code: string): Promise<MailResult> {
  return sendTemplatedMail({
    to: email,
    scene: "registerCode",
    variables: {
      nickname: email,
      code
    },
    respectNotificationToggle: false
  });
}
