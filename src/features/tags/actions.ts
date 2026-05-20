"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { createTag, deleteTag, updateTag } from "@/features/tags/service";
import { localizedPath, urlLocales } from "@/lib/locale-url";

export type TagActionState = {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string[]>;
};

const initialFieldErrors: Record<string, string[]> = {};

function success(message: string): TagActionState {
  return { ok: true, message, fieldErrors: initialFieldErrors };
}

function failure(message: string, fieldErrors: Record<string, string[]> = initialFieldErrors): TagActionState {
  return { ok: false, message, fieldErrors };
}

function revalidateTagPaths() {
  for (const locale of urlLocales) {
    revalidatePath(localizedPath(locale, "/tags"));
    revalidatePath(localizedPath(locale, "/articles"));
  }
  revalidatePath("/console/tags");
  revalidatePath("/console/articles");
}

export async function createTagAction(
  _previousState: TagActionState,
  formData: FormData
): Promise<TagActionState> {
  try {
    const user = await requireUser();
    await createTag(user, {
      name: formData.get("name"),
      slug: formData.get("slug"),
      color: formData.get("color")
    });
    revalidateTagPaths();
    return success("标签已创建。");
  } catch (error) {
    if (error instanceof ZodError) {
      return failure("请检查表单中标出的字段。", error.flatten().fieldErrors as Record<string, string[]>);
    }

    return failure(error instanceof Error ? error.message : "创建标签失败。");
  }
}

export async function updateTagAction(
  _previousState: TagActionState,
  formData: FormData
): Promise<TagActionState> {
  try {
    const user = await requireUser();
    await updateTag(user, {
      id: formData.get("id"),
      name: formData.get("name"),
      slug: formData.get("slug"),
      color: formData.get("color")
    });
    revalidateTagPaths();
    return success("标签已更新。");
  } catch (error) {
    if (error instanceof ZodError) {
      return failure("请检查表单中标出的字段。", error.flatten().fieldErrors as Record<string, string[]>);
    }

    return failure(error instanceof Error ? error.message : "更新标签失败。");
  }
}

export async function deleteTagAction(
  _previousState: TagActionState,
  formData: FormData
): Promise<TagActionState> {
  try {
    const user = await requireUser();
    await deleteTag(user, String(formData.get("id") ?? ""));
    revalidateTagPaths();
    return success("标签已删除。");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "删除标签失败。");
  }
}
