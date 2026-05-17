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
import { beginTotpSetup, confirmTotpSetup, disableTotp } from "@/features/account/totp-service";

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
      message: "Please check the highlighted fields.",
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
    revalidatePath("/admin/account");
    revalidatePath("/admin");
    return { ok: true, message: "Profile saved." };
  } catch (error) {
    return errorState(error, "Failed to save profile.");
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
    return { ok: true, message: "Password updated." };
  } catch (error) {
    return errorState(error, "Failed to update password.");
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
    revalidatePath("/admin/account");
    return { ok: true, message: "Session revoked." };
  } catch (error) {
    return errorState(error, "Failed to revoke session.");
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
    revalidatePath("/admin/account");
    return { ok: true, message: "Trusted device revoked." };
  } catch (error) {
    return errorState(error, "Failed to revoke trusted device.");
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
    revalidatePath("/admin/account");
    return { ok: true, message: "Passkey deleted." };
  } catch (error) {
    return errorState(error, "Failed to delete passkey.");
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
    revalidatePath("/admin/account");
    return { ok: true, message: "Passkey renamed." };
  } catch (error) {
    return errorState(error, "Failed to rename passkey.");
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
    revalidatePath("/admin/account");
    return {
      ok: true,
      message: "Scan the QR code or enter the manual key, then verify a 6-digit code.",
      secret: setup.secret,
      qrCodeDataUrl: setup.qrCodeDataUrl
    };
  } catch (error) {
    return errorState(error, "Failed to start TOTP setup.");
  }
}

export async function confirmTotpSetupAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    const recoveryCodes = await confirmTotpSetup(user, String(formData.get("code") ?? ""));
    revalidatePath("/account");
    revalidatePath("/admin/account");
    return {
      ok: true,
      message: "TOTP enabled. Save these recovery codes now; they will not be shown again.",
      recoveryCodes
    };
  } catch (error) {
    return errorState(error, "Failed to verify TOTP setup.");
  }
}

export async function disableTotpAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const user = await requireUser();
    await disableTotp(user, {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      code: String(formData.get("code") ?? ""),
      recoveryCode: String(formData.get("recoveryCode") ?? "")
    });
    revalidatePath("/account");
    revalidatePath("/admin/account");
    return { ok: true, message: "TOTP disabled." };
  } catch (error) {
    return errorState(error, "Failed to disable TOTP.");
  }
}
