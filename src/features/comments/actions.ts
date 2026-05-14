"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { updateCommentStatus } from "@/features/comments/service";

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
