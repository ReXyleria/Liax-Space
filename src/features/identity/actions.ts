"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { createIdentity, deleteIdentity, updateIdentity } from "@/features/identity/service";

export type IdentityActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

function collectPermissions(formData: FormData) {
  return formData.getAll("permissions").map(String);
}

function errorState(error: unknown, fallback: string): IdentityActionState {
  if (error instanceof ZodError) {
    return {
      ok: false,
      message: "请检查高亮字段。",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>
    };
  }

  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback
  };
}

export async function createIdentityAction(
  _previousState: IdentityActionState,
  formData: FormData
): Promise<IdentityActionState> {
  try {
    const user = await requireUser();
    await createIdentity(user, {
      key: formData.get("key"),
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      permissions: collectPermissions(formData)
    });
    revalidatePath("/console/identity");
    revalidatePath("/console/users");
    return { ok: true, message: "身份已创建。" };
  } catch (error) {
    return errorState(error, "创建身份失败。");
  }
}

export async function updateIdentityAction(
  id: string,
  _previousState: IdentityActionState,
  formData: FormData
): Promise<IdentityActionState> {
  try {
    const user = await requireUser();
    await updateIdentity(user, {
      id,
      key: formData.get("key"),
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      permissions: collectPermissions(formData)
    });
    revalidatePath("/console/identity");
    revalidatePath("/console/users");
    return { ok: true, message: "身份已保存。" };
  } catch (error) {
    return errorState(error, "保存身份失败。");
  }
}

export async function deleteIdentityAction(
  _previousState: IdentityActionState,
  formData: FormData
): Promise<IdentityActionState> {
  try {
    const user = await requireUser();
    const id = String(formData.get("id") ?? "");
    const confirmUsed = formData.get("confirmUsed") === "1";
    await deleteIdentity(user, id, {
      confirmUsed,
      migrationTargetIdentityId: String(formData.get("migrationTargetIdentityId") ?? "") || null
    });
    revalidatePath("/console/identity");
    revalidatePath("/console/users");
    return { ok: true, message: "身份已删除。" };
  } catch (error) {
    return errorState(error, "删除身份失败。");
  }
}
