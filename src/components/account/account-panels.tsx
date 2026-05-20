"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Copy, Download, Fingerprint, KeyRound, Laptop, ShieldCheck, UserRound } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  beginTotpSetupAction,
  confirmTotpSetupAction,
  deletePasskeyAction,
  disableTotpAction,
  renamePasskeyAction,
  revokeSessionAction,
  revokeTrustedDeviceAction,
  sendTotpDisableEmailCodeAction,
  updatePasswordAction,
  updateProfileAction,
  type AccountActionState
} from "@/features/account/actions";
import type { Locale } from "@/lib/i18n-messages";

export type SessionItem = {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

export type PasskeyItem = {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type TrustedDeviceItem = {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

const initialState: AccountActionState = { ok: false, message: "" };

function accountText(locale: Locale) {
  return locale === "en"
    ? {
        close: "Close",
        cancel: "Cancel",
        never: "Never",
        unknownDevice: "Unknown device",
        profileTitle: "Profile",
        profileDescription: "Avatar and nickname are shown in account menus and public profile areas.",
        nickname: "Nickname",
        avatar: "Avatar",
        avatarHelper: "Upload a square avatar or paste an image URL.",
        emailVerified: "Email verified",
        emailUnverified: "Email not verified",
        saveProfile: "Save profile",
        saving: "Saving...",
        passwordTitle: "Password security",
        passwordDescription: "Update your login password. Passkeys and TOTP are not removed automatically.",
        currentPassword: "Current password",
        newPassword: "New password",
        confirmPassword: "Confirm new password",
        updatePassword: "Update password",
        updating: "Updating...",
        sessionsTitle: "Login sessions",
        sessionsDescription: "Revoke active login sessions that should no longer stay signed in.",
        trustedTitle: "Trusted devices",
        trustedDescription: "Remove devices that may skip second-factor verification.",
        lastUsed: "Last used",
        expires: "Expires",
        revoke: "Revoke",
        noSessions: "No login sessions.",
        noTrustedDevices: "No trusted devices.",
        confirmRevokeSessionTitle: "Revoke login session?",
        confirmRevokeSessionDescription: "This login session will expire immediately and that device must sign in again.",
        confirmRevokeTrustedTitle: "Revoke trusted device?",
        confirmRevokeTrustedDescription: "This device will need to complete second-factor verification again.",
        passkeysTitle: "Passkeys",
        passkeysDescription: "Bind, rename, or remove WebAuthn passkeys for passwordless sign-in.",
        bindPasskey: "Bind passkey",
        binding: "Binding...",
        unnamedPasskey: "Unnamed passkey",
        created: "Created",
        rename: "Rename",
        delete: "Delete",
        noPasskeys: "No passkeys have been bound.",
        confirmDeletePasskeyTitle: "Delete passkey?",
        confirmDeletePasskeyDescription: "This passkey can no longer be used for passwordless sign-in.",
        passkeyStartFailed: "Unable to start passkey binding.",
        passkeyRegistered: "Passkey bound.",
        passkeyFailed: "Passkey binding failed.",
        passkeyCanceled: "Passkey binding was cancelled or failed.",
        invalidServerResponse: "The server returned an invalid response.",
        totpTitle: "Two-factor authentication",
        totpDescription: "Protect password sign-in with authenticator codes and one-time recovery codes.",
        totpEnabled: "TOTP is enabled for this account.",
        disableMethodTotp: "Password + TOTP/recovery code",
        disableMethodEmail: "Password + email code",
        sendEmailHint: "Send a one-time email code before disabling TOTP with this method.",
        sendEmailCode: "Send email code",
        sending: "Sending...",
        authenticatorCode: "6-digit authenticator code",
        recoveryCode: "Or recovery code",
        emailCode: "Email verification code",
        disableTotp: "Disable TOTP",
        disabling: "Disabling...",
        disableTotpTitle: "Disable TOTP?",
        disableTotpDescription: "This account will lose authenticator-code protection. Continue only after verifying the selected method.",
        startTotpSetup: "Start TOTP setup",
        preparing: "Preparing...",
        qrAlt: "TOTP QR code",
        manualKey: "Manual key",
        sixDigitCode: "6-digit code",
        verifyEnable: "Verify and enable",
        verifying: "Verifying...",
        recoveryTitle: "TOTP recovery codes",
        recoveryDescription: "Save these 10 one-time recovery codes now. Each code can be used once and will not be shown again.",
        copyCodes: "Copy codes",
        downloadTxt: "Download TXT",
        savedCodes: "I have saved them",
        recoveryWarning: "Recovery codes are shown only once.",
        codesCopied: "Recovery codes copied.",
        codesDownloaded: "Recovery code text file generated."
      }
    : {
        close: "关闭",
        cancel: "取消",
        never: "从未",
        unknownDevice: "未知设备",
        profileTitle: "个人资料",
        profileDescription: "头像和昵称会显示在账号菜单与公开资料区域。",
        nickname: "昵称",
        avatar: "头像",
        avatarHelper: "上传方形头像，或粘贴图片地址。",
        emailVerified: "邮箱已验证",
        emailUnverified: "邮箱未验证",
        saveProfile: "保存资料",
        saving: "保存中...",
        passwordTitle: "密码安全",
        passwordDescription: "更新账号登录密码。通行密钥和 TOTP 不会被自动移除。",
        currentPassword: "当前密码",
        newPassword: "新密码",
        confirmPassword: "确认新密码",
        updatePassword: "更新密码",
        updating: "更新中...",
        sessionsTitle: "登录会话",
        sessionsDescription: "撤销不应继续保持登录的有效会话。",
        trustedTitle: "可信设备",
        trustedDescription: "移除可以跳过二次验证的受信设备。",
        lastUsed: "最近使用",
        expires: "过期时间",
        revoke: "撤销",
        noSessions: "暂无登录会话。",
        noTrustedDevices: "暂无可信设备。",
        confirmRevokeSessionTitle: "确认撤销登录会话？",
        confirmRevokeSessionDescription: "该登录会话会立即失效，对应设备需要重新登录。",
        confirmRevokeTrustedTitle: "确认撤销可信设备？",
        confirmRevokeTrustedDescription: "该设备之后需要重新完成二次验证。",
        passkeysTitle: "通行密钥",
        passkeysDescription: "绑定、重命名或删除用于免密码登录的 WebAuthn 通行密钥。",
        bindPasskey: "绑定通行密钥",
        binding: "绑定中...",
        unnamedPasskey: "未命名通行密钥",
        created: "创建",
        rename: "重命名",
        delete: "删除",
        noPasskeys: "尚未绑定通行密钥。",
        confirmDeletePasskeyTitle: "确认删除通行密钥？",
        confirmDeletePasskeyDescription: "删除后该通行密钥不能再用于免密码登录。",
        passkeyStartFailed: "无法开始通行密钥绑定。",
        passkeyRegistered: "通行密钥已绑定。",
        passkeyFailed: "通行密钥绑定失败。",
        passkeyCanceled: "通行密钥绑定已取消或失败。",
        invalidServerResponse: "服务端返回了无效响应。",
        totpTitle: "双因素验证",
        totpDescription: "使用动态验证码和一次性恢复码保护密码登录。",
        totpEnabled: "当前账号已启用 TOTP。",
        disableMethodTotp: "密码 + 动态验证码/恢复码",
        disableMethodEmail: "密码 + 邮箱验证码",
        sendEmailHint: "使用该方式关闭 TOTP 前，需要先发送一次性邮箱验证码。",
        sendEmailCode: "发送邮箱验证码",
        sending: "发送中...",
        authenticatorCode: "6 位动态验证码",
        recoveryCode: "或输入恢复码",
        emailCode: "邮箱验证码",
        disableTotp: "关闭 TOTP",
        disabling: "关闭中...",
        disableTotpTitle: "确认关闭 TOTP？",
        disableTotpDescription: "关闭后该账号将失去动态验证码保护。请确认已通过所选方式完成验证。",
        startTotpSetup: "开始设置 TOTP",
        preparing: "准备中...",
        qrAlt: "TOTP 二维码",
        manualKey: "手动密钥",
        sixDigitCode: "6 位验证码",
        verifyEnable: "验证并启用",
        verifying: "验证中...",
        recoveryTitle: "TOTP 恢复码",
        recoveryDescription: "请立即保存这 10 个一次性恢复码。每个恢复码只能使用一次，关闭后不会再次显示。",
        copyCodes: "复制恢复码",
        downloadTxt: "下载 TXT",
        savedCodes: "我已保存",
        recoveryWarning: "恢复码只显示一次。",
        codesCopied: "恢复码已复制。",
        codesDownloaded: "恢复码 TXT 文件已生成。"
      };
}

function ActionMessage({ state }: { state: AccountActionState }) {
  if (!state.message) {
    return null;
  }
  return (
    <p
      className={
        state.ok
          ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
      }
    >
      {state.message}
    </p>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.[0]) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

function formatDateTime(locale: Locale, value: Date | string | null | undefined) {
  if (!value) {
    return accountText(locale).never;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function readJson(
  response: Response,
  fallback: string
): Promise<{ ok?: boolean; message?: string } & Record<string, unknown>> {
  return response.json().catch(() => ({ ok: false, message: fallback }));
}

function PanelShell({
  icon,
  title,
  description,
  children
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden bg-card/92 shadow-soft">
      <CardHeader className="border-b bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

export function ProfilePanel({
  nickname,
  avatar,
  email,
  emailVerified,
  locale = "zh-CN"
}: {
  nickname: string;
  avatar: string | null;
  email: string;
  emailVerified: boolean;
  locale?: Locale;
}) {
  const text = accountText(locale);
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    updateProfileAction,
    initialState
  );

  return (
    <PanelShell
      icon={<UserRound className="h-5 w-5" />}
      title={text.profileTitle}
      description={text.profileDescription}
    >
      <form action={formAction} className="space-y-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium">{text.nickname}</span>
          <Input name="nickname" defaultValue={nickname} required maxLength={32} />
          <FieldError messages={state.fieldErrors?.nickname} />
        </label>
        <ImageUploadField
          name="avatar"
          label={text.avatar}
          helper={text.avatarHelper}
          defaultValue={avatar ?? ""}
          compact
          previewFit="contain"
        />
        <FieldError messages={state.fieldErrors?.avatar} />
        <div className="rounded-md border bg-background/70 p-3 text-sm">
          <p className="font-medium">{email}</p>
          <p className="mt-1 text-muted-foreground">{emailVerified ? text.emailVerified : text.emailUnverified}</p>
        </div>
        <ActionMessage state={state} />
        <Button type="submit" disabled={isPending}>
          {isPending ? text.saving : text.saveProfile}
        </Button>
      </form>
    </PanelShell>
  );
}

export function PasswordPanel({ locale = "zh-CN" }: { locale?: Locale }) {
  const text = accountText(locale);
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    updatePasswordAction,
    initialState
  );

  return (
    <PanelShell
      icon={<KeyRound className="h-5 w-5" />}
      title={text.passwordTitle}
      description={text.passwordDescription}
    >
      <form action={formAction} className="space-y-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium">{text.currentPassword}</span>
          <Input name="currentPassword" type="password" autoComplete="current-password" required />
          <FieldError messages={state.fieldErrors?.currentPassword} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">{text.newPassword}</span>
          <Input name="newPassword" type="password" autoComplete="new-password" required />
          <FieldError messages={state.fieldErrors?.newPassword} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">{text.confirmPassword}</span>
          <Input name="confirmPassword" type="password" autoComplete="new-password" required />
          <FieldError messages={state.fieldErrors?.confirmPassword} />
        </label>
        <ActionMessage state={state} />
        <Button type="submit" disabled={isPending}>
          {isPending ? text.updating : text.updatePassword}
        </Button>
      </form>
    </PanelShell>
  );
}

export function SessionsPanel({ sessions, locale = "zh-CN" }: { sessions: SessionItem[]; locale?: Locale }) {
  const text = accountText(locale);
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    revokeSessionAction,
    initialState
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <PanelShell icon={<Laptop className="h-5 w-5" />} title={text.sessionsTitle} description={text.sessionsDescription}>
      <div className="space-y-3">
        <ActionMessage state={state} />
        {sessions.length ? (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background/60 p-3"
            >
              <div className="text-sm">
                <p className="font-medium">{session.deviceName || text.unknownDevice}</p>
                <p className="text-muted-foreground">{text.lastUsed}: {formatDateTime(locale, session.lastUsedAt)}</p>
                <p className="text-muted-foreground">{text.expires}: {formatDateTime(locale, session.expiresAt)}</p>
              </div>
              <Button type="button" variant="secondary" disabled={isPending} onClick={() => setConfirmingId(session.id)}>
                {text.revoke}
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">{text.noSessions}</p>
        )}
      </div>
      <ConfirmActionDialog
        open={Boolean(confirmingId)}
        title={text.confirmRevokeSessionTitle}
        description={text.confirmRevokeSessionDescription}
        confirmLabel={text.revoke}
        cancelLabel={text.cancel}
        closeLabel={text.close}
        pending={isPending}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingId(null);
          }
        }}
        action={formAction}
        hiddenFields={confirmingId ? [{ name: "id", value: confirmingId }] : []}
      />
    </PanelShell>
  );
}

export function TrustedDevicesPanel({ devices, locale = "zh-CN" }: { devices: TrustedDeviceItem[]; locale?: Locale }) {
  const text = accountText(locale);
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    revokeTrustedDeviceAction,
    initialState
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <PanelShell icon={<Laptop className="h-5 w-5" />} title={text.trustedTitle} description={text.trustedDescription}>
      <div className="space-y-3">
        <ActionMessage state={state} />
        {devices.length ? (
          devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background/60 p-3"
            >
              <div className="text-sm">
                <p className="font-medium">{device.deviceName || text.unknownDevice}</p>
                <p className="text-muted-foreground">{text.lastUsed}: {formatDateTime(locale, device.lastUsedAt)}</p>
                <p className="text-muted-foreground">{text.expires}: {formatDateTime(locale, device.expiresAt)}</p>
              </div>
              <Button type="button" variant="secondary" disabled={isPending} onClick={() => setConfirmingId(device.id)}>
                {text.revoke}
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">{text.noTrustedDevices}</p>
        )}
      </div>
      <ConfirmActionDialog
        open={Boolean(confirmingId)}
        title={text.confirmRevokeTrustedTitle}
        description={text.confirmRevokeTrustedDescription}
        confirmLabel={text.revoke}
        cancelLabel={text.cancel}
        closeLabel={text.close}
        pending={isPending}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingId(null);
          }
        }}
        action={formAction}
        hiddenFields={confirmingId ? [{ name: "id", value: confirmingId }] : []}
      />
    </PanelShell>
  );
}

export function PasskeysPanel({ passkeys, locale = "zh-CN" }: { passkeys: PasskeyItem[]; locale?: Locale }) {
  const text = accountText(locale);
  const router = useRouter();
  const [registerState, setRegisterState] = useState<AccountActionState>(initialState);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isRegistering, startRegistering] = useTransition();
  const [deleteState, deleteAction, isDeleting] = useActionState<AccountActionState, FormData>(
    deletePasskeyAction,
    initialState
  );
  const [renameState, renameAction, isRenaming] = useActionState<AccountActionState, FormData>(
    renamePasskeyAction,
    initialState
  );

  function registerPasskey() {
    startRegistering(async () => {
      try {
        const { startRegistration } = await import("@simplewebauthn/browser");
        const optionsResponse = await fetch("/api/auth/passkey/register/options", { method: "POST" });
        const options = await readJson(optionsResponse, text.invalidServerResponse);

        if (!optionsResponse.ok) {
          setRegisterState({ ok: false, message: locale === "en" ? options.message ?? text.passkeyStartFailed : text.passkeyStartFailed });
          return;
        }

        const response = await startRegistration({
          optionsJSON: options as unknown as Parameters<typeof startRegistration>[0]["optionsJSON"]
        });
        const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response)
        });
        const result = await readJson(verifyResponse, text.invalidServerResponse);
        const ok = verifyResponse.ok && Boolean(result.ok);
        setRegisterState({
          ok,
          message: locale === "en" ? result.message ?? (ok ? text.passkeyRegistered : text.passkeyFailed) : ok ? text.passkeyRegistered : text.passkeyFailed
        });
        if (ok) {
          router.refresh();
        }
      } catch (error) {
        setRegisterState({
          ok: false,
          message: locale === "en" && error instanceof Error ? error.message : text.passkeyCanceled
        });
      }
    });
  }

  return (
    <PanelShell
      icon={<Fingerprint className="h-5 w-5" />}
      title={text.passkeysTitle}
      description={text.passkeysDescription}
    >
      <div className="space-y-3">
        <Button type="button" variant="secondary" disabled={isRegistering} onClick={registerPasskey}>
          {isRegistering ? text.binding : text.bindPasskey}
        </Button>
        <ActionMessage state={registerState} />
        <ActionMessage state={renameState} />
        <ActionMessage state={deleteState} />
        {passkeys.length ? (
          passkeys.map((passkey) => (
            <div key={passkey.id} className="space-y-3 rounded-md border bg-background/60 p-3">
              <div className="text-sm">
                <p className="font-medium">{passkey.deviceName || text.unnamedPasskey}</p>
                <p className="text-muted-foreground">
                  {text.created}: {formatDateTime(locale, passkey.createdAt)} · {text.lastUsed}: {formatDateTime(locale, passkey.lastUsedAt)}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <form action={renameAction} className="contents">
                  <input type="hidden" name="id" value={passkey.id} />
                  <Input name="deviceName" defaultValue={passkey.deviceName ?? text.unnamedPasskey} maxLength={80} />
                  <Button type="submit" variant="secondary" disabled={isRenaming}>
                    {text.rename}
                  </Button>
                </form>
                <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setConfirmingDeleteId(passkey.id)}>
                  {text.delete}
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">{text.noPasskeys}</p>
        )}
      </div>
      <ConfirmActionDialog
        open={Boolean(confirmingDeleteId)}
        title={text.confirmDeletePasskeyTitle}
        description={text.confirmDeletePasskeyDescription}
        confirmLabel={text.delete}
        cancelLabel={text.cancel}
        closeLabel={text.close}
        pending={isDeleting}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingDeleteId(null);
          }
        }}
        action={deleteAction}
        hiddenFields={confirmingDeleteId ? [{ name: "id", value: confirmingDeleteId }] : []}
      />
    </PanelShell>
  );
}

export function TotpPanel({ enabled, locale = "zh-CN" }: { enabled: boolean; locale?: Locale }) {
  const text = accountText(locale);
  const router = useRouter();
  const disableFormRef = useRef<HTMLFormElement>(null);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [disableConfirmed, setDisableConfirmed] = useState(false);
  const [disableMethod, setDisableMethod] = useState<"totpOrRecovery" | "emailCode">("totpOrRecovery");
  const [setupState, setupAction, isStarting] = useActionState<AccountActionState, FormData>(
    beginTotpSetupAction,
    initialState
  );
  const [confirmState, confirmAction, isConfirming] = useActionState<AccountActionState, FormData>(
    confirmTotpSetupAction,
    initialState
  );
  const [disableState, disableAction, isDisabling] = useActionState<AccountActionState, FormData>(
    disableTotpAction,
    initialState
  );
  const [emailCodeState, emailCodeAction, isSendingEmailCode] = useActionState<AccountActionState, FormData>(
    sendTotpDisableEmailCodeAction,
    initialState
  );
  const [recoveryCopyMessage, setRecoveryCopyMessage] = useState("");
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [oneTimeRecoveryCodes, setOneTimeRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    if (confirmState.recoveryCodes?.length) {
      setOneTimeRecoveryCodes(confirmState.recoveryCodes);
      setRecoveryCopyMessage("");
      setRecoveryModalOpen(true);
    }
  }, [confirmState.recoveryCodes]);

  function recoveryText() {
    return oneTimeRecoveryCodes.join("\n");
  }

  async function copyRecoveryCodes() {
    const codes = recoveryText();
    if (!codes) return;
    await navigator.clipboard.writeText(codes);
    setRecoveryCopyMessage(text.codesCopied);
  }

  function downloadRecoveryCodes() {
    const codes = recoveryText();
    if (!codes) return;
    const blob = new Blob([codes + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "liax-space-totp-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
    setRecoveryCopyMessage(text.codesDownloaded);
  }

  function closeRecoveryModal() {
    setRecoveryModalOpen(false);
    setOneTimeRecoveryCodes([]);
    setRecoveryCopyMessage("");
    router.refresh();
  }

  return (
    <PanelShell
      icon={<ShieldCheck className="h-5 w-5" />}
      title={text.totpTitle}
      description={text.totpDescription}
    >
      {enabled ? (
        <div className="space-y-4">
          <div className="rounded-md border bg-emerald-50 p-3 text-sm text-emerald-700">
            {text.totpEnabled}
          </div>
          <div className="grid gap-2 rounded-md border bg-muted/25 p-1 text-sm sm:grid-cols-2">
            <button
              type="button"
              className={
                disableMethod === "totpOrRecovery"
                  ? "rounded px-3 py-2 text-left transition bg-background text-foreground shadow-sm"
                  : "rounded px-3 py-2 text-left transition text-muted-foreground hover:bg-background/60"
              }
              onClick={() => setDisableMethod("totpOrRecovery")}
            >
              {text.disableMethodTotp}
            </button>
            <button
              type="button"
              className={
                disableMethod === "emailCode"
                  ? "rounded px-3 py-2 text-left transition bg-background text-foreground shadow-sm"
                  : "rounded px-3 py-2 text-left transition text-muted-foreground hover:bg-background/60"
              }
              onClick={() => setDisableMethod("emailCode")}
            >
              {text.disableMethodEmail}
            </button>
          </div>
          {disableMethod === "emailCode" ? (
            <form action={emailCodeAction} className="space-y-3 rounded-md border bg-muted/20 p-3">
              <p className="text-sm text-muted-foreground">{text.sendEmailHint}</p>
              <Button type="submit" variant="secondary" disabled={isSendingEmailCode}>
                {isSendingEmailCode ? text.sending : text.sendEmailCode}
              </Button>
              <ActionMessage state={emailCodeState} />
            </form>
          ) : null}
          <form
            ref={disableFormRef}
            action={disableAction}
            className="space-y-3"
            onSubmit={(event) => {
              if (disableConfirmed) {
                setDisableConfirmed(false);
                return;
              }
              event.preventDefault();
              setDisableConfirmOpen(true);
            }}
          >
            <input type="hidden" name="method" value={disableMethod} />
            <Input name="currentPassword" type="password" placeholder={text.currentPassword} autoComplete="current-password" required />
            {disableMethod === "totpOrRecovery" ? (
              <>
                <Input name="code" inputMode="numeric" placeholder={text.authenticatorCode} maxLength={6} />
                <Input name="recoveryCode" placeholder={text.recoveryCode} />
              </>
            ) : (
              <Input name="emailCode" inputMode="numeric" placeholder={text.emailCode} maxLength={8} required />
            )}
            <ActionMessage state={disableState} />
            <Button type="submit" variant="secondary" disabled={isDisabling}>
              {isDisabling ? text.disabling : text.disableTotp}
            </Button>
          </form>
          <ConfirmActionDialog
            open={disableConfirmOpen}
            title={text.disableTotpTitle}
            description={text.disableTotpDescription}
            confirmLabel={text.disableTotp}
            cancelLabel={text.cancel}
            closeLabel={text.close}
            pending={isDisabling}
            onOpenChange={setDisableConfirmOpen}
            onConfirm={() => {
              setDisableConfirmed(true);
              setDisableConfirmOpen(false);
              window.setTimeout(() => disableFormRef.current?.requestSubmit(), 0);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <form action={setupAction}>
            <Button type="submit" variant="secondary" disabled={isStarting}>
              {isStarting ? text.preparing : text.startTotpSetup}
            </Button>
          </form>

          {setupState.qrCodeDataUrl && setupState.secret ? (
            <div className="space-y-3 rounded-md border bg-muted/35 p-4">
              <Image
                src={setupState.qrCodeDataUrl}
                alt={text.qrAlt}
                width={176}
                height={176}
                unoptimized
                className="rounded-md bg-white p-2"
              />
              <div className="rounded-md border bg-background p-3 text-sm">
                <p className="font-medium">{text.manualKey}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{setupState.secret}</p>
              </div>
              <form action={confirmAction} className="flex flex-col gap-3 sm:flex-row">
                <Input name="code" inputMode="numeric" placeholder={text.sixDigitCode} maxLength={6} required />
                <Button type="submit" disabled={isConfirming}>
                  {isConfirming ? text.verifying : text.verifyEnable}
                </Button>
              </form>
            </div>
          ) : null}

          <ActionMessage state={setupState} />
          <ActionMessage state={confirmState} />
        </div>
      )}

      <Dialog
        open={recoveryModalOpen}
        title={text.recoveryTitle}
        description={text.recoveryDescription}
        closeLabel={text.close}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeRecoveryModal();
          }
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={copyRecoveryCodes}>
              <Copy className="mr-2 h-4 w-4" />
              {text.copyCodes}
            </Button>
            <Button type="button" variant="secondary" onClick={downloadRecoveryCodes}>
              <Download className="mr-2 h-4 w-4" />
              {text.downloadTxt}
            </Button>
            <Button type="button" onClick={closeRecoveryModal}>
              {text.savedCodes}
            </Button>
          </div>
        }
      >
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{text.recoveryWarning}</p>
          <div className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-2">
            {oneTimeRecoveryCodes.map((code) => (
              <span key={code} className="rounded bg-white px-2 py-1">
                {code}
              </span>
            ))}
          </div>
          {recoveryCopyMessage ? <p className="mt-3 text-xs">{recoveryCopyMessage}</p> : null}
        </div>
      </Dialog>
    </PanelShell>
  );
}
