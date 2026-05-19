"use server";

import { revalidatePath } from "next/cache";
import { GuestbookStatus } from "@prisma/client";
import { ZodError } from "zod";
import { getCurrentUser, requireUser } from "@/lib/auth";
import {
  createGuestbookComment,
  createGuestbookMessage,
  deleteGuestbookMessage,
  moderateGuestbookMessage,
  toggleGuestbookLike
} from "@/features/guestbook/service";
import { guestbookCommentCreateSchema, guestbookCreateSchema, guestbookLikeSchema } from "@/features/guestbook/validators";
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
  revalidatePath("/admin/settings/translation");
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
      message: parsed.data.notifyOnly ? "重要留言已发送到邮箱。" : "留言已提交并公开展示。",
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

export async function hideGuestbookMessageAction(
  _previousState: GuestbookActionState,
  formData: FormData
): Promise<GuestbookActionState> {
  formData.set("status", GuestbookStatus.HIDDEN);
  return moderateGuestbookMessageAction(_previousState, formData);
}

export async function deleteGuestbookMessageAction(
  _previousState: GuestbookActionState,
  formData: FormData
): Promise<GuestbookActionState> {
  try {
    const user = await requireUser();
    await deleteGuestbookMessage(user, String(formData.get("id") ?? ""));
    revalidateGuestbookPaths();
    return { ok: true, message: "留言已彻底删除。", fieldErrors: {} };
  } catch (error) {
    return stateFromError(error, "留言删除失败，请稍后重试。");
  }
}

export async function replyGuestbookMessageAction(
  _previousState: GuestbookActionState,
  formData: FormData
): Promise<GuestbookActionState> {
  formData.set("status", GuestbookStatus.APPROVED);
  return moderateGuestbookMessageAction(_previousState, formData);
}

export async function createGuestbookCommentAction(
  _previousState: GuestbookActionState,
  formData: FormData
): Promise<GuestbookActionState> {
  const input = {
    messageId: formData.get("messageId"),
    nickname: formData.get("nickname"),
    email: formData.get("email"),
    content: formData.get("content")
  };
  const parsed = guestbookCommentCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "请检查评论表单。",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    };
  }

  try {
    const user = await getCurrentUser();
    await createGuestbookComment(parsed.data, user);
    revalidateGuestbookPaths();
    return { ok: true, message: "评论已发布。", fieldErrors: {} };
  } catch (error) {
    return stateFromError(error, "评论提交失败，请稍后重试。");
  }
}

export async function toggleGuestbookLikeAction(
  _previousState: GuestbookActionState,
  formData: FormData
): Promise<GuestbookActionState> {
  const parsed = guestbookLikeSchema.safeParse({
    messageId: formData.get("messageId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "留言不存在。",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    };
  }

  try {
    const user = await requireUser();
    const result = await toggleGuestbookLike(user, parsed.data);
    revalidateGuestbookPaths();
    return {
      ok: true,
      message: result.liked ? "已点赞。" : "已取消点赞。",
      fieldErrors: {}
    };
  } catch (error) {
    return stateFromError(error, "点赞失败，请登录后重试。");
  }
}
