"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteMediaAssets, deleteUnusedMedia, rescanMediaReferences } from "@/features/media/service";

export type MediaActionState = {
  ok: boolean;
  message: string;
};

export async function rescanMediaAction(): Promise<void> {
  const user = await requireUser();
  await rescanMediaReferences(user);
  revalidatePath("/admin/media");
  revalidatePath("/admin/data/media");
}

export async function deleteUnusedMediaAction(
  _previousState: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  try {
    const user = await requireUser();
    const confirmed = formData.get("confirm") === "DELETE_UNUSED";
    if (!confirmed) {
      return { ok: false, message: "Type DELETE_UNUSED before deleting." };
    }
    const ids = formData.getAll("assetId").map(String);
    const count = await deleteUnusedMedia(user, ids);
    revalidatePath("/admin/media");
    revalidatePath("/admin/data/media");
    return { ok: true, message: `Deleted ${count} unused assets.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to delete unused assets."
    };
  }
}

export async function deleteMediaAssetsAction(
  _previousState: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  try {
    const user = await requireUser();
    const ids = formData.getAll("assetId").map(String);
    if (!ids.length) {
      return { ok: false, message: "请选择要删除的附件。" };
    }
    const count = await deleteMediaAssets(user, ids);
    revalidatePath("/admin/media");
    revalidatePath("/admin/data/media");
    return { ok: true, message: `已删除 ${count} 个附件。` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "附件删除失败。"
    };
  }
}
