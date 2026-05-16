"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { toggleCommentPin, updateCommentStatus, muteUser } from "@/features/comments/service";

export type CommentActionState = {
  ok: boolean;
  message: string;
};

export async function updateCommentStatusAction(
  _previousState: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  try {
    const user = await requireUser();
    await updateCommentStatus(user, {
      id: formData.get("id"),
      status: formData.get("status")
    });
    revalidatePath("/admin/comments");
    return { ok: true, message: "评论状态已更新。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "评论状态更新失败。"
    };
  }
}

export async function setCommentStatusAction(formData: FormData) {
  try {
    const user = await requireUser();
    await updateCommentStatus(user, {
      id: formData.get("id"),
      status: formData.get("status")
    });
    revalidatePath("/admin/comments");
  } catch (error) {
    console.error("Failed to update comment status", error);
  }
}

export async function muteUserAction(
  _previousState: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  try {
    const user = await requireUser();
    const duration = String(formData.get("duration") ?? "1h");
    const targetUserId = String(formData.get("userId") ?? "");

    const mutedUntil = await muteUser(user, { userId: targetUserId, duration });
    revalidatePath("/admin/comments");

    const durationLabels: Record<string, string> = {
      "1h": "1 小时",
      "3h": "3 小时",
      "5h": "5 小时",
      "1d": "1 天",
      "1mo": "1 个月",
      permanent: "永久"
    };

    return {
      ok: true,
      message: `已禁言该用户${durationLabels[duration] ?? duration}（至 ${new Date(mutedUntil).toLocaleString("zh-CN")}）。`
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "禁言操作失败。"
    };
  }
}

export async function toggleCommentPinnedAction(formData: FormData) {
  try {
    const user = await requireUser();
    const id = String(formData.get("id") ?? "");
    await toggleCommentPin(user, id);
    revalidatePath("/admin/comments");
  } catch (error) {
    console.error("Failed to toggle comment pin", error);
  }
}
