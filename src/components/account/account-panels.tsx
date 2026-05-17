"use client";

import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Copy, Download, Fingerprint, KeyRound, Laptop, ShieldCheck, UserRound } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
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
        <ImageUploadField name="avatar" label="头像" defaultValue={avatar ?? ""} compact previewFit="contain" />
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
        <label className="space-y-2 text-sm">
          <span className="font-medium">确认新密码</span>
          <Input name="confirmPassword" type="password" autoComplete="new-password" required />
          <FieldError messages={state.fieldErrors?.confirmPassword} />
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <PanelShell icon={<Laptop className="h-5 w-5" />} title="登录会话" description="撤销仍然有效的登录状态。">
      <div className="space-y-3">
        <ActionMessage state={state} />
        {sessions.length ? (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background/60 p-3"
            >
              <div className="text-sm">
                <p className="font-medium">{session.deviceName || "未知设备"}</p>
                <p className="text-muted-foreground">最近使用：{formatDateTime(session.lastUsedAt)}</p>
                <p className="text-muted-foreground">过期时间：{formatDateTime(session.expiresAt)}</p>
              </div>
              <Button type="button" variant="secondary" disabled={isPending} onClick={() => setConfirmingId(session.id)}>
                撤销
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">暂无登录会话。</p>
        )}
      </div>
      <ConfirmActionDialog
        open={Boolean(confirmingId)}
        title="确认撤销登录会话"
        description="该登录会话会立即失效，相关设备需要重新登录。"
        confirmLabel="撤销"
        cancelLabel="取消"
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

export function TrustedDevicesPanel({ devices }: { devices: TrustedDeviceItem[] }) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    revokeTrustedDeviceAction,
    initialState
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <PanelShell icon={<Laptop className="h-5 w-5" />} title="可信设备" description="移除不再信任的设备记录。">
      <div className="space-y-3">
        <ActionMessage state={state} />
        {devices.length ? (
          devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background/60 p-3"
            >
              <div className="text-sm">
                <p className="font-medium">{device.deviceName || "未知设备"}</p>
                <p className="text-muted-foreground">最近使用：{formatDateTime(device.lastUsedAt)}</p>
                <p className="text-muted-foreground">过期时间：{formatDateTime(device.expiresAt)}</p>
              </div>
              <Button type="button" variant="secondary" disabled={isPending} onClick={() => setConfirmingId(device.id)}>
                撤销
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">暂无可信设备。</p>
        )}
      </div>
      <ConfirmActionDialog
        open={Boolean(confirmingId)}
        title="确认撤销可信设备"
        description="该设备之后不能再跳过二次验证，需要重新完成信任流程。"
        confirmLabel="撤销"
        cancelLabel="取消"
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

export function PasskeysPanel({ passkeys }: { passkeys: PasskeyItem[] }) {
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
                <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setConfirmingDeleteId(passkey.id)}>
                  删除
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">尚未绑定通行密钥。</p>
        )}
      </div>
      <ConfirmActionDialog
        open={Boolean(confirmingDeleteId)}
        title="确认删除通行密钥"
        description="删除后该通行密钥不能再用于无密码登录。"
        confirmLabel="删除"
        cancelLabel="取消"
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

export function TotpPanel({ enabled }: { enabled: boolean }) {
  const disableFormRef = useRef<HTMLFormElement>(null);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [disableConfirmed, setDisableConfirmed] = useState(false);
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
  const [recoveryCopyMessage, setRecoveryCopyMessage] = useState("");

  function recoveryText() {
    return confirmState.recoveryCodes?.join("\n") ?? "";
  }

  async function copyRecoveryCodes() {
    const text = recoveryText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setRecoveryCopyMessage("恢复码已复制。");
  }

  function downloadRecoveryCodes() {
    const text = recoveryText();
    if (!text) return;
    const blob = new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "liax-space-totp-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
    setRecoveryCopyMessage("恢复码文件已生成。");
  }

  return (
    <PanelShell
      icon={<ShieldCheck className="h-5 w-5" />}
      title="双因素验证"
      description="使用 6 位动态验证码和一次性恢复码保护密码登录。"
    >
      {enabled ? (
        <>
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
          <ConfirmActionDialog
            open={disableConfirmOpen}
            title="确认关闭 TOTP"
            description="关闭后账号会失去动态验证码保护。"
            confirmLabel="关闭 TOTP"
            cancelLabel="取消"
            pending={isDisabling}
            onOpenChange={setDisableConfirmOpen}
            onConfirm={() => {
              setDisableConfirmed(true);
              setDisableConfirmOpen(false);
              window.setTimeout(() => disableFormRef.current?.requestSubmit(), 0);
            }}
          />
        </>
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={copyRecoveryCodes}>
                  <Copy className="mr-2 h-4 w-4" />
                  复制恢复码
                </Button>
                <Button type="button" variant="secondary" onClick={downloadRecoveryCodes}>
                  <Download className="mr-2 h-4 w-4" />
                  下载恢复码
                </Button>
              </div>
              {recoveryCopyMessage ? <p className="mt-2 text-xs">{recoveryCopyMessage}</p> : null}
            </div>
          ) : null}
        </div>
      )}
    </PanelShell>
  );
}
