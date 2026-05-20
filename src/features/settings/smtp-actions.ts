"use server";

import { SettingType, UserRole } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, isDatabaseConfigured } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { sendSmtpTestMail } from "@/lib/mail";

export type SmtpActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const smtpSchema = z.object({
  host: z.string().trim().min(1, "SMTP 服务器地址不能为空。"),
  port: z.coerce.number().int().min(1, "端口号不正确。").max(65535, "端口号不正确。"),
  user: z.string().trim().min(1, "用户名不能为空。"),
  pass: z.string().optional(),
  from: z.string().trim().email("请输入有效的发信地址。"),
  fromName: z.string().trim().max(80, "显示名称不能超过 80 个字符。").optional(),
  encryption: z.enum(["none", "starttls", "ssl_tls"], {
    errorMap: () => ({ message: "请选择有效的加密方式。" })
  }),
  notificationsEnabled: z.boolean()
});

function readSmtpInput(formData: FormData) {
  return {
    host: formData.get("smtp.host"),
    port: formData.get("smtp.port"),
    user: formData.get("smtp.user"),
    pass: String(formData.get("smtp.pass") ?? ""),
    from: formData.get("smtp.from"),
    fromName: formData.get("smtp.fromName") ?? "",
    encryption: formData.get("smtp.encryption") ?? "starttls",
    notificationsEnabled: formData.get("smtp.notificationsEnabled") === "on" ||
      formData.get("smtp.notificationsEnabled") === "true"
  };
}

function revalidateSmtpPages() {
  revalidateTag("settings");
  revalidatePath("/console/mail/smtp");
  revalidatePath("/console", "layout");
}

async function requireSettingsUser() {
  const user = await requireUser();
  assertPermission(canManageSettings(user), "你没有权限管理 SMTP 设置。");
  return user;
}

async function hasStoredPassword() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const existing = await db.setting.findUnique({
    where: { key: "smtp.pass" },
    select: { value: true }
  });
  return Boolean(existing?.value);
}

async function getStoredPassword() {
  if (!isDatabaseConfigured()) {
    return "";
  }

  const existing = await db.setting.findUnique({
    where: { key: "smtp.pass" },
    select: { value: true }
  });
  return existing?.value ?? "";
}

async function firstConsoleEmail(fallback: string) {
  if (!isDatabaseConfigured()) {
    return fallback;
  }

  const console = await db.user.findFirst({
    where: { role: UserRole.Administer, emailVerified: true },
    orderBy: { createdAt: "asc" },
    select: { email: true }
  });
  return console?.email || fallback;
}

export async function saveSmtpSettingsAction(
  _previousState: SmtpActionState,
  formData: FormData
): Promise<SmtpActionState> {
  try {
    const parsed = smtpSchema.safeParse(readSmtpInput(formData));
    if (!parsed.success) {
      return {
        ok: false,
        message: "请检查 SMTP 表单中标出的字段。",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
      };
    }

    await requireSettingsUser();
    const password = parsed.data.pass?.trim() ?? "";
    const hasPassword = password || await hasStoredPassword();
    if (!hasPassword) {
      return {
        ok: false,
        message: "请检查 SMTP 表单中标出的字段。",
        fieldErrors: { pass: ["密码不能为空。"] }
      };
    }

    await db.$transaction([
      db.setting.upsert({
        where: { key: "smtp.host" },
        update: { value: parsed.data.host, group: "SMTP", type: SettingType.TEXT },
        create: { key: "smtp.host", value: parsed.data.host, group: "SMTP", type: SettingType.TEXT }
      }),
      db.setting.upsert({
        where: { key: "smtp.port" },
        update: { value: String(parsed.data.port), group: "SMTP", type: SettingType.NUMBER },
        create: { key: "smtp.port", value: String(parsed.data.port), group: "SMTP", type: SettingType.NUMBER }
      }),
      db.setting.upsert({
        where: { key: "smtp.user" },
        update: { value: parsed.data.user, group: "SMTP", type: SettingType.TEXT },
        create: { key: "smtp.user", value: parsed.data.user, group: "SMTP", type: SettingType.TEXT }
      }),
      ...(password
        ? [
            db.setting.upsert({
              where: { key: "smtp.pass" },
              update: { value: password, group: "SMTP", type: SettingType.PASSWORD },
              create: { key: "smtp.pass", value: password, group: "SMTP", type: SettingType.PASSWORD }
            })
          ]
        : []),
      db.setting.upsert({
        where: { key: "smtp.from" },
        update: { value: parsed.data.from, group: "SMTP", type: SettingType.TEXT },
        create: { key: "smtp.from", value: parsed.data.from, group: "SMTP", type: SettingType.TEXT }
      }),
      db.setting.upsert({
        where: { key: "smtp.fromName" },
        update: { value: parsed.data.fromName ?? "", group: "SMTP", type: SettingType.TEXT },
        create: { key: "smtp.fromName", value: parsed.data.fromName ?? "", group: "SMTP", type: SettingType.TEXT }
      }),
      db.setting.upsert({
        where: { key: "smtp.encryption" },
        update: { value: parsed.data.encryption, group: "SMTP", type: SettingType.TEXT },
        create: { key: "smtp.encryption", value: parsed.data.encryption, group: "SMTP", type: SettingType.TEXT }
      }),
      db.setting.upsert({
        where: { key: "smtp.notificationsEnabled" },
        update: { value: parsed.data.notificationsEnabled ? "true" : "false", group: "SMTP", type: SettingType.BOOLEAN },
        create: {
          key: "smtp.notificationsEnabled",
          value: parsed.data.notificationsEnabled ? "true" : "false",
          group: "SMTP",
          type: SettingType.BOOLEAN
        }
      })
    ]);

    revalidateSmtpPages();
    return { ok: true, message: "SMTP 设置已保存。", fieldErrors: {} };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "SMTP 设置保存失败。",
      fieldErrors: {}
    };
  }
}

export async function testSmtpSettingsAction(
  _previousState: SmtpActionState,
  formData: FormData
): Promise<SmtpActionState> {
  try {
    const user = await requireSettingsUser();
    const parsed = smtpSchema.safeParse(readSmtpInput(formData));
    if (!parsed.success) {
      return {
        ok: false,
        message: "请检查 SMTP 表单中标出的字段。",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
      };
    }
    const pass = parsed.data.pass?.trim() || await getStoredPassword();
    if (!pass) {
      return {
        ok: false,
        message: "请检查 SMTP 表单中标出的字段。",
        fieldErrors: { pass: ["密码不能为空。"] }
      };
    }
    const to = await firstConsoleEmail(user.email);
    const result = await sendSmtpTestMail(to, {
      "smtp.host": parsed.data.host,
      "smtp.port": String(parsed.data.port),
      "smtp.user": parsed.data.user,
      "smtp.pass": pass,
      "smtp.from": parsed.data.from,
      "smtp.fromName": parsed.data.fromName ?? "",
      "smtp.encryption": parsed.data.encryption
    });
    if (!result.ok) {
      return { ok: false, message: `测试邮件发送失败：${result.message}`, fieldErrors: {} };
    }
    return { ok: true, message: `测试邮件已发送到 ${to}。`, fieldErrors: {} };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "测试邮件发送失败。",
      fieldErrors: {}
    };
  }
}
