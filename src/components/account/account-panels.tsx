"use client";

import { useActionState, useState, useTransition } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound, Laptop, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Input } from "@/components/ui/input";
import {
  beginTotpSetupAction,
  confirmTotpSetupAction,
  deletePasskeyAction,
  disableTotpAction,
  renamePasskeyAction,
  revokeSessionAction,
  revokeTrustedDeviceAction,
  updatePasswordAction,
  updateProfileAction,
  type AccountActionState
} from "@/features/account/actions";

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

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "从未";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function readJson(response: Response): Promise<{ ok?: boolean; message?: string } & Record<string, unknown>> {
  return response.json().catch(() => ({ ok: false, message: "服务端返回了无效响应。" }));
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
  emailVerified
}: {
  nickname: string;
  avatar: string | null;
  email: string;
  emailVerified: boolean;
}) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    updateProfileAction,
    initialState
  );

  return (
    <PanelShell
      icon={<UserRound className="h-5 w-5" />}
      title="个人资料"
      description="头像和昵称会同步到后台用户菜单与站主展示。"
    >
      <form action={formAction} className="space-y-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium">昵称</span>
          <Input name="nickname" defaultValue={nickname} required maxLength={32} />
          <FieldError messages={state.fieldErrors?.nickname} />
        </label>
        <ImageUploadField name="avatar" label="头像" defaultValue={avatar ?? ""} compact />
        <FieldError messages={state.fieldErrors?.avatar} />
        <div className="rounded-md border bg-background/70 p-3 text-sm">
          <p className="font-medium">{email}</p>
          <p className="mt-1 text-muted-foreground">{emailVerified ? "邮箱已验证" : "邮箱未验证"}</p>
        </div>
        <ActionMessage state={state} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : "保存资料"}
        </Button>
      </form>
    </PanelShell>
  );
}

export function PasswordPanel() {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    updatePasswordAction,
    initialState
  );

  return (
    <PanelShell
      icon={<KeyRound className="h-5 w-5" />}
      title="密码安全"
      description="更新账号密码。通行密钥和 TOTP 不会被自动移除。"
    >
      <form action={formAction} className="space-y-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium">当前密码</span>
          <Input name="currentPassword" type="password" autoComplete="current-password" required />
          <FieldError messages={state.fieldErrors?.currentPassword} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">新密码</span>
          <Input name="newPassword" type="password" autoComplete="new-password" required />
          <FieldError messages={state.fieldErrors?.newPassword} />
        </label>
        <ActionMessage state={state} />
        <Button type="submit" disabled={isPending}>
          {isPending ? "更新中..." : "更新密码"}
        </Button>
      </form>
    </PanelShell>
  );
}

export function SessionsPanel({ sessions }: { sessions: SessionItem[] }) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    revokeSessionAction,
    initialState
  );

  return (
    <PanelShell
      icon={<Laptop className="h-5 w-5" />}
      title="登录会话"
      description="撤销仍然有效的登录状态。"
    >
      <div className="space-y-3">
        <ActionMessage state={state} />
        {sessions.length ? (
          sessions.map((session) => (
            <form
              key={session.id}
              action={formAction}
              className="flex items-center justify-between gap-3 rounded-md border bg-background/60 p-3"
            >
              <input type="hidden" name="id" value={session.id} />
              <div className="text-sm">
                <p className="font-medium">{session.deviceName || "未知设备"}</p>
                <p className="text-muted-foreground">最近使用：{formatDateTime(session.lastUsedAt)}</p>
                <p className="text-muted-foreground">过期时间：{formatDateTime(session.expiresAt)}</p>
              </div>
              <Button type="submit" variant="secondary" disabled={isPending}>
                撤销
              </Button>
            </form>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">暂无登录会话。</p>
        )}
      </div>
    </PanelShell>
  );
}

export function TrustedDevicesPanel({ devices }: { devices: TrustedDeviceItem[] }) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    revokeTrustedDeviceAction,
    initialState
  );

  return (
    <PanelShell
      icon={<Laptop className="h-5 w-5" />}
      title="可信设备"
      description="移除不再信任的设备记录。"
    >
      <div className="space-y-3">
        <ActionMessage state={state} />
        {devices.length ? (
          devices.map((device) => (
            <form
              key={device.id}
              action={formAction}
              className="flex items-center justify-between gap-3 rounded-md border bg-background/60 p-3"
            >
              <input type="hidden" name="id" value={device.id} />
              <div className="text-sm">
                <p className="font-medium">{device.deviceName || "未知设备"}</p>
                <p className="text-muted-foreground">最近使用：{formatDateTime(device.lastUsedAt)}</p>
                <p className="text-muted-foreground">过期时间：{formatDateTime(device.expiresAt)}</p>
              </div>
              <Button type="submit" variant="secondary" disabled={isPending}>
                撤销
              </Button>
            </form>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">暂无可信设备。</p>
        )}
      </div>
    </PanelShell>
  );
}

export function PasskeysPanel({ passkeys }: { passkeys: PasskeyItem[] }) {
  const router = useRouter();
  const [registerState, setRegisterState] = useState<AccountActionState>(initialState);
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
        const options = await readJson(optionsResponse);

        if (!optionsResponse.ok) {
          setRegisterState({ ok: false, message: options.message ?? "无法开始通行密钥绑定。" });
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
        const result = await readJson(verifyResponse);
        setRegisterState({
          ok: verifyResponse.ok && Boolean(result.ok),
          message: result.message ?? (verifyResponse.ok ? "通行密钥已绑定。" : "通行密钥绑定失败。")
        });
        if (verifyResponse.ok && result.ok) {
          router.refresh();
        }
      } catch (error) {
        setRegisterState({
          ok: false,
          message: error instanceof Error ? error.message : "通行密钥绑定已取消或失败。"
        });
      }
    });
  }

  return (
    <PanelShell
      icon={<Fingerprint className="h-5 w-5" />}
      title="通行密钥"
      description="绑定、重命名或移除用于无密码登录的 WebAuthn 通行密钥。"
    >
      <div className="space-y-3">
        <Button type="button" variant="secondary" disabled={isRegistering} onClick={registerPasskey}>
          {isRegistering ? "绑定中..." : "绑定通行密钥"}
        </Button>
        <ActionMessage state={registerState} />
        <ActionMessage state={renameState} />
        <ActionMessage state={deleteState} />
        {passkeys.length ? (
          passkeys.map((passkey) => (
            <div key={passkey.id} className="space-y-3 rounded-md border bg-background/60 p-3">
              <div className="text-sm">
                <p className="font-medium">{passkey.deviceName || "未命名通行密钥"}</p>
                <p className="text-muted-foreground">
                  创建：{formatDateTime(passkey.createdAt)} · 最近使用：{formatDateTime(passkey.lastUsedAt)}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <form action={renameAction} className="contents">
                  <input type="hidden" name="id" value={passkey.id} />
                  <Input name="deviceName" defaultValue={passkey.deviceName ?? "Passkey"} maxLength={80} />
                  <Button type="submit" variant="secondary" disabled={isRenaming}>
                    重命名
                  </Button>
                </form>
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={passkey.id} />
                  <Button type="submit" variant="secondary" disabled={isDeleting}>
                    删除
                  </Button>
                </form>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">尚未绑定通行密钥。</p>
        )}
      </div>
    </PanelShell>
  );
}

export function TotpPanel({ enabled }: { enabled: boolean }) {
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

  return (
    <PanelShell
      icon={<ShieldCheck className="h-5 w-5" />}
      title="双因素验证"
      description="使用 6 位动态验证码和一次性恢复码保护密码登录。"
    >
      {enabled ? (
        <form action={disableAction} className="space-y-3">
          <div className="rounded-md border bg-emerald-50 p-3 text-sm text-emerald-700">
            当前账号已启用 TOTP。
          </div>
          <Input name="currentPassword" type="password" placeholder="当前密码" autoComplete="current-password" required />
          <Input name="code" inputMode="numeric" placeholder="6 位动态验证码" maxLength={6} />
          <Input name="recoveryCode" placeholder="或恢复码" />
          <ActionMessage state={disableState} />
          <Button type="submit" variant="secondary" disabled={isDisabling}>
            {isDisabling ? "关闭中..." : "关闭 TOTP"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <form action={setupAction}>
            <Button type="submit" variant="secondary" disabled={isStarting}>
              {isStarting ? "准备中..." : "开始设置 TOTP"}
            </Button>
          </form>

          {setupState.qrCodeDataUrl && setupState.secret ? (
            <div className="space-y-3 rounded-md border bg-muted/35 p-4">
              <Image
                src={setupState.qrCodeDataUrl}
                alt="TOTP QR code"
                width={176}
                height={176}
                unoptimized
                className="rounded-md bg-white p-2"
              />
              <div className="rounded-md border bg-background p-3 text-sm">
                <p className="font-medium">手动密钥</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{setupState.secret}</p>
              </div>
              <form action={confirmAction} className="flex flex-col gap-3 sm:flex-row">
                <Input name="code" inputMode="numeric" placeholder="6 位验证码" maxLength={6} required />
                <Button type="submit" disabled={isConfirming}>
                  {isConfirming ? "验证中..." : "验证并启用"}
                </Button>
              </form>
            </div>
          ) : null}

          <ActionMessage state={setupState} />
          <ActionMessage state={confirmState} />
          {confirmState.recoveryCodes?.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">恢复码只会显示一次，请立即保存。</p>
              <div className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-2">
                {confirmState.recoveryCodes.map((code) => (
                  <span key={code} className="rounded bg-white px-2 py-1">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PanelShell>
  );
}
