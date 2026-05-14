"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createManagedUser,
  deleteManagedUser,
  revokeManagedSession,
  revokeManagedTrustedDevice,
  updateUserRoleStatus
} from "@/features/users/service";
import { userCreateSchema } from "@/features/users/validators";

export type UserActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  values?: {
    email?: string;
    username?: string;
    nickname?: string;
    identityId?: string | null;
    status?: string;
    sendWelcomeEmail?: boolean;
  };
};

function createUserValues(formData: FormData): NonNullable<UserActionState["values"]> {
  return {
    email: String(formData.get("email") ?? ""),
    username: String(formData.get("username") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    identityId: String(formData.get("identityId") ?? "") || null,
    status: String(formData.get("status") ?? ""),
    sendWelcomeEmail: formData.get("sendWelcomeEmail") === "on"
  };
}

export async function updateUserAction(
  _previousState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    const user = await requireUser();
    await updateUserRoleStatus(user, {
      id: formData.get("id"),
      email: formData.get("email") || undefined,
      nickname: formData.get("nickname") || undefined,
      password: formData.get("password") || undefined,
      identityId: formData.get("identityId") || null,
      status: formData.get("status")
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "用户设置已保存。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "保存用户设置失败。"
    };
  }
}

export async function createUserAction(
  _previousState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const values = createUserValues(formData);
  const input = {
    ...values,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  };
  const parsed = userCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "请修正高亮字段。",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values
    };
  }

  try {
    const user = await requireUser();
    await createManagedUser(user, parsed.data);
    revalidatePath("/admin/users");
    return { ok: true, message: "用户已创建。", fieldErrors: {}, values: {} };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "创建用户失败。",
      fieldErrors: {},
      values
    };
  }
}

export async function deleteUserAction(
  _previousState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    const user = await requireUser();
    await deleteManagedUser(user, String(formData.get("id") ?? ""));
    revalidatePath("/admin/users");
    revalidatePath("/admin/devices");
    return { ok: true, message: "用户及其数据已删除。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "删除用户失败。"
    };
  }
}


export async function revokeUserSessionAction(
  _previousState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    const user = await requireUser();
    await revokeManagedSession(user, { id: formData.get("id") });
    revalidatePath("/admin/users");
    return { ok: true, message: "会话已撤销。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "撤销会话失败。"
    };
  }
}

export async function revokeUserSessionFormAction(formData: FormData) {
  await revokeUserSessionAction({ ok: false, message: "" }, formData);
}

export async function revokeTrustedDeviceAction(
  _previousState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    const user = await requireUser();
    await revokeManagedTrustedDevice(user, { id: formData.get("id") });
    revalidatePath("/admin/devices");
    return { ok: true, message: "可信设备已撤销。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "撤销可信设备失败。"
    };
  }
}

export async function revokeTrustedDeviceFormAction(formData: FormData) {
  await revokeTrustedDeviceAction({ ok: false, message: "" }, formData);
}
