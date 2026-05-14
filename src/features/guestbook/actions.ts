"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { createGuestbookMessage, moderateGuestbookMessage } from "@/features/guestbook/service";
import { guestbookCreateSchema } from "@/features/guestbook/validators";

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

export async function createGuestbookMessageAction(
  _previousState: GuestbookActionState,
  formData: FormData
): Promise<GuestbookActionState> {
  const input = {
    nickname: formData.get("nickname"),
    email: formData.get("email"),
    content: formData.get("content")
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
    await createGuestbookMessage(parsed.data);
    revalidatePath("/guestbook");
    return { ok: true, message: "留言已提交。", fieldErrors: {} };
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
    revalidatePath("/admin/guestbook");
    revalidatePath("/guestbook");
    return { ok: true, message: "留言已保存。", fieldErrors: {} };
  } catch (error) {
    return stateFromError(error, "留言保存失败，请稍后重试。");
  }
}
