"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { createGuestbookMessage, moderateGuestbookMessage } from "@/features/guestbook/service";
import { guestbookCreateSchema } from "@/features/guestbook/validators";
import { localizedPath, urlLocales } from "@/lib/locale-url";

export type GuestbookActionState = {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string[]>;
};

function stateFromError(error: unknown, fallback: string): GuestbookActionState {
  if (error instanceof ZodError) {
    return {
      ok: false,
      message: "请检查表单中标出的字段。",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(fallback, error);
  }

  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback,
    fieldErrors: {}
  };
}

function revalidateGuestbookPaths() {
  for (const locale of urlLocales) {
    revalidatePath(localizedPath(locale, "/guestbook"));
  }
  revalidatePath("/admin/guestbook");
}

export async function createGuestbookMessageAction(
  _previousState: GuestbookActionState,
  formData: FormData
): Promise<GuestbookActionState> {
  const input = {
    nickname: formData.get("nickname"),
    email: formData.get("email"),
    content: formData.get("content"),
    notifyOnly: formData.get("notifyOnly") === "true"
  };
  const parsed = guestbookCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "请检查表单中标出的字段。",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    };
  }

  try {
    const user = await getCurrentUser();
    await createGuestbookMessage(parsed.data, user);
    revalidateGuestbookPaths();
    return {
      ok: true,
      message: parsed.data.notifyOnly ? "重要留言已发送到邮箱。" : "留言已提交。",
      fieldErrors: {}
    };
  } catch (error) {
    return stateFromError(error, "留言提交失败，请稍后重试。");
  }
}

export async function moderateGuestbookMessageAction(
  _previousState: GuestbookActionState,
  formData: FormData
): Promise<GuestbookActionState> {
  try {
    const user = await requireUser();
    await moderateGuestbookMessage(user, {
      id: formData.get("id"),
      reply: formData.get("reply") ?? "",
      status: formData.get("status")
    });
    revalidateGuestbookPaths();
    return { ok: true, message: "留言已保存。", fieldErrors: {} };
  } catch (error) {
    return stateFromError(error, "留言保存失败，请稍后重试。");
  }
}
