"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { getSafeDeviceName } from "@/lib/device";
import { createMoment, createMomentComment, deleteMoment, toggleMomentLike, updateMoment } from "@/features/moments/service";

export type MomentActionState = {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string[]>;
};

function success(message: string): MomentActionState {
  return { ok: true, message, fieldErrors: {} };
}

function failure(message: string, fieldErrors: Record<string, string[]> = {}): MomentActionState {
  return { ok: false, message, fieldErrors };
}

function parseMomentPayload(formData: FormData) {
  const createdAtRaw = formData.get("createdAt");
  return {
    id: String(formData.get("id") ?? "").trim() || undefined,
    content: formData.get("content"),
    images: String(formData.get("images") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    visibility: formData.get("visibility"),
    pinned: formData.get("pinned") === "on",
    createdAt: createdAtRaw ? new Date(String(createdAtRaw)).toISOString() : undefined
  };
}

function revalidateMomentPaths() {
  revalidatePath("/moments");
  revalidatePath("/admin/moments");
}

export async function createMomentAction(
  _previousState: MomentActionState,
  formData: FormData
): Promise<MomentActionState> {
  try {
    const user = await requireUser();
    await createMoment(user, parseMomentPayload(formData));
    revalidateMomentPaths();
    return success("瞬间已发布。");
  } catch (error) {
    if (error instanceof ZodError) {
      return failure("请检查表单中标出的字段。", error.flatten().fieldErrors as Record<string, string[]>);
    }

    return failure(error instanceof Error ? error.message : "瞬间发布失败。");
  }
}

export async function updateMomentAction(
  _previousState: MomentActionState,
  formData: FormData
): Promise<MomentActionState> {
  try {
    const user = await requireUser();
    await updateMoment(user, parseMomentPayload(formData));
    revalidateMomentPaths();
    return success("瞬间已更新。");
  } catch (error) {
    if (error instanceof ZodError) {
      return failure("请检查表单中标出的字段。", error.flatten().fieldErrors as Record<string, string[]>);
    }

    return failure(error instanceof Error ? error.message : "瞬间更新失败。");
  }
}

export async function deleteMomentAction(
  _previousState: MomentActionState,
  formData: FormData
): Promise<MomentActionState> {
  try {
    const user = await requireUser();
    await deleteMoment(user, String(formData.get("id") ?? ""));
    revalidateMomentPaths();
    return success("瞬间已删除。");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "瞬间删除失败。");
  }
}

export async function toggleMomentLikeAction(momentId: string) {
  const user = await requireUser();
  await toggleMomentLike(user, momentId);
  revalidatePath("/moments");
}

export async function createMomentCommentAction(formData: FormData) {
  const user = await requireUser();
  const headerStore = await headers();
  await createMomentComment(user, {
    momentId: formData.get("momentId"),
    content: formData.get("content"),
    deviceName: getSafeDeviceName(headerStore.get("user-agent"))
  });
  revalidatePath("/moments");
}
