"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import {
  deletePasskey,
  renamePasskey,
  revokeSession,
  revokeTrustedDevice,
  updatePassword,
  updateProfile
} from "@/features/account/service";
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
  sendTotpDisableEmailCode
} from "@/features/account/totp-service";

export type AccountActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  secret?: string;
  qrCodeDataUrl?: string;
  recoveryCodes?: string[];
};

function errorState(error: unknown, fallback: string): AccountActionState {
  if (error instanceof ZodError) {
    return {
      ok: false,
      message: "请检查标记的表单项。",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>
    };
  }

  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback
  };
}

export async function updateProfileAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    await updateProfile(user, {
      nickname: formData.get("nickname"),
      avatar: formData.get("avatar") ?? ""
    });
    revalidatePath("/account");
    revalidatePath("/console/account");
    revalidatePath("/console");
    return { ok: true, message: "资料已保存。" };
  } catch (error) {
    return errorState(error, "保存资料失败。");
  }
}

export async function updatePasswordAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    await updatePassword(user, {
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword")
    });
    return { ok: true, message: "密码已更新。" };
  } catch (error) {
    return errorState(error, "更新密码失败。");
  }
}

export async function revokeSessionAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    await revokeSession(user, { id: formData.get("id") });
    revalidatePath("/account");
    revalidatePath("/console/account");
    return { ok: true, message: "登录会话已撤销。" };
  } catch (error) {
    return errorState(error, "撤销登录会话失败。");
  }
}

export async function revokeTrustedDeviceAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    await revokeTrustedDevice(user, { id: formData.get("id") });
    revalidatePath("/account");
    revalidatePath("/console/account");
    return { ok: true, message: "可信设备已撤销。" };
  } catch (error) {
    return errorState(error, "撤销可信设备失败。");
  }
}

export async function deletePasskeyAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    await deletePasskey(user, { id: formData.get("id") });
    revalidatePath("/account");
    revalidatePath("/console/account");
    return { ok: true, message: "通行密钥已删除。" };
  } catch (error) {
    return errorState(error, "删除通行密钥失败。");
  }
}

export async function renamePasskeyAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    await renamePasskey(user, {
      id: formData.get("id"),
      deviceName: formData.get("deviceName")
    });
    revalidatePath("/account");
    revalidatePath("/console/account");
    return { ok: true, message: "通行密钥已重命名。" };
  } catch (error) {
    return errorState(error, "重命名通行密钥失败。");
  }
}

export async function beginTotpSetupAction(
  _previousState: AccountActionState,
  _formData: FormData
): Promise<AccountActionState> {
  void _previousState;
  void _formData;

  try {
    const user = await requireUser();
    const setup = await beginTotpSetup(user);
    revalidatePath("/account");
    revalidatePath("/console/account");
    return {
      ok: true,
      message: "请扫描二维码或输入手动密钥，然后填写 6 位验证码。",
      secret: setup.secret,
      qrCodeDataUrl: setup.qrCodeDataUrl
    };
  } catch (error) {
    return errorState(error, "开始设置 TOTP 失败。");
  }
}

export async function confirmTotpSetupAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    const recoveryCodes = await confirmTotpSetup(user, String(formData.get("code") ?? ""));
    return {
      ok: true,
      message: "TOTP 已启用。请立即保存恢复码，关闭后不会再次显示。",
      recoveryCodes
    };
  } catch (error) {
    return errorState(error, "验证 TOTP 设置失败。");
  }
}

export async function sendTotpDisableEmailCodeAction(
  _previousState: AccountActionState,
  _formData: FormData
): Promise<AccountActionState> {
  void _previousState;
  void _formData;

  try {
    const user = await requireUser();
    await sendTotpDisableEmailCode(user);
    return { ok: true, message: "TOTP 关闭验证码已发送到你的邮箱。" };
  } catch (error) {
    return errorState(error, "发送 TOTP 关闭验证码失败。");
  }
}

export async function disableTotpAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    await disableTotp(user, {
      method: formData.get("method") === "emailCode" ? "emailCode" : "totpOrRecovery",
      currentPassword: String(formData.get("currentPassword") ?? ""),
      code: String(formData.get("code") ?? ""),
      recoveryCode: String(formData.get("recoveryCode") ?? ""),
      emailCode: String(formData.get("emailCode") ?? "")
    });
    revalidatePath("/account");
    revalidatePath("/console/account");
    return { ok: true, message: "TOTP 已关闭。" };
  } catch (error) {
    return errorState(error, "关闭 TOTP 失败。");
  }
}
