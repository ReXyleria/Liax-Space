"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { getAdminLocale, type Locale } from "@/lib/i18n";
import { sendMailTemplateTest, updateMailTemplate } from "@/features/mail/service";

export type MailTemplateActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

function text(locale: Locale) {
  return locale === "en"
    ? {
        checkFields: "Please check the highlighted fields.",
        saved: "Mail template saved.",
        saveFailed: "Failed to save mail template.",
        testSent: "Test email sent to your account email.",
        testFailed: "Failed to send test email."
      }
    : {
        checkFields: "请检查高亮字段。",
        saved: "邮件模板已保存。",
        saveFailed: "保存邮件模板失败。",
        testSent: "测试邮件已发送到你的账号邮箱。",
        testFailed: "发送测试邮件失败。"
      };
}

function errorStateWithLocale(error: unknown, fallback: string, locale: Locale): MailTemplateActionState {
  const messages = text(locale);
  if (error instanceof ZodError) {
    return {
      ok: false,
      message: messages.checkFields,
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>
    };
  }

  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback
  };
}

function readInput(formData: FormData) {
  return {
    scene: formData.get("scene"),
    subject: formData.get("subject"),
    bodyHtml: formData.get("bodyHtml")
  };
}

export async function updateMailTemplateAction(
  _previousState: MailTemplateActionState,
  formData: FormData
): Promise<MailTemplateActionState> {
  try {
    const locale = await getAdminLocale();
    const user = await requireUser();
    await updateMailTemplate(user, readInput(formData));
    revalidatePath("/admin/settings");
    return { ok: true, message: text(locale).saved };
  } catch (error) {
    const locale = await getAdminLocale().catch(() => "zh-CN" as Locale);
    return errorStateWithLocale(error, text(locale).saveFailed, locale);
  }
}

export async function testMailTemplateAction(
  _previousState: MailTemplateActionState,
  formData: FormData
): Promise<MailTemplateActionState> {
  try {
    const locale = await getAdminLocale();
    const user = await requireUser();
    await sendMailTemplateTest(user, readInput(formData));
    revalidatePath("/admin/settings");
    return { ok: true, message: text(locale).testSent };
  } catch (error) {
    const locale = await getAdminLocale().catch(() => "zh-CN" as Locale);
    return errorStateWithLocale(error, text(locale).testFailed, locale);
  }
}
