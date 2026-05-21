import { MailTemplateScene } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageMailTemplates } from "@/lib/permissions";
import { sendTemplatedMail } from "@/lib/mail";
import {
  legacyMailTemplateDefaults,
  mailDbSceneToDefinition,
  mailTemplateDefinitions,
  sampleVariables
} from "@/features/mail/templates";
import { mailTemplateUpdateSchema } from "@/features/mail/validators";

export async function ensureMailTemplates() {
  if (!isDatabaseConfigured()) {
    return;
  }

  await Promise.all(
    mailTemplateDefinitions.map(async (definition) => {
      await db.mailTemplate.upsert({
        where: { scene: definition.scene },
        update: {},
        create: {
          scene: definition.scene,
          subject: definition.subject,
          bodyHtml: definition.bodyHtml
        }
      });

      const legacy = legacyMailTemplateDefaults.get(definition.scene);
      if (legacy?.subjects?.length) {
        await db.mailTemplate.updateMany({
          where: {
            scene: definition.scene,
            subject: { in: legacy.subjects }
          },
          data: { subject: definition.subject }
        });
      }

      if (legacy?.bodyHtmls?.length) {
        await db.mailTemplate.updateMany({
          where: {
            scene: definition.scene,
            bodyHtml: { in: legacy.bodyHtmls }
          },
          data: { bodyHtml: definition.bodyHtml }
        });
      }
    })
  );
}

export async function listMailTemplates(user: CurrentUser) {
  assertPermission(canManageMailTemplates(user), "You do not have permission to manage mail templates.");

  if (!isDatabaseConfigured()) {
    return { templates: [], logs: [], error: "DATABASE_URL is not configured." };
  }

  try {
    await ensureMailTemplates();
    const [templates, logs] = await Promise.all([
      db.mailTemplate.findMany({ orderBy: { scene: "asc" } }),
      db.mailSendLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
    ]);

    return {
      templates: templates.map((template) => {
        const definition = mailDbSceneToDefinition.get(template.scene);
        return {
          ...template,
          category: definition?.category ?? "Other",
          name: definition?.name ?? template.scene,
          description: definition?.description ?? ""
        };
      }),
      logs,
      error: null
    };
  } catch (error) {
    console.error("Failed to list mail templates", error);
    return { templates: [], logs: [], error: "Failed to load mail templates." };
  }
}

export async function updateMailTemplate(user: CurrentUser, input: unknown) {
  assertPermission(canManageMailTemplates(user), "You do not have permission to update mail templates.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const parsed = mailTemplateUpdateSchema.parse(input);
  await db.mailTemplate.upsert({
    where: { scene: parsed.scene },
    update: {
      subject: parsed.subject,
      bodyHtml: parsed.bodyHtml
    },
    create: {
      scene: parsed.scene,
      subject: parsed.subject,
      bodyHtml: parsed.bodyHtml
    }
  });
}

export async function sendMailTemplateTest(user: CurrentUser, input: unknown) {
  assertPermission(canManageMailTemplates(user), "You do not have permission to test mail templates.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const parsed = mailTemplateUpdateSchema.parse(input);
  const result = await sendTemplatedMail({
    to: user.email,
    scene: parsed.scene as MailTemplateScene,
    variables: sampleVariables(),
    respectNotificationToggle: false,
    templateOverride: {
      subject: parsed.subject,
      bodyHtml: parsed.bodyHtml
    }
  });

  if (!result.ok) {
    throw new Error(result.message);
  }
}
