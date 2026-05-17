"use client";

import { useMemo, useState } from "react";
import { Fingerprint, KeyRound, Laptop, ShieldCheck, UserRound } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  PasskeysPanel,
  PasswordPanel,
  ProfilePanel,
  SessionsPanel,
  TotpPanel,
  TrustedDevicesPanel,
  type PasskeyItem,
  type SessionItem,
  type TrustedDeviceItem
} from "@/components/account/account-panels";
import type { Locale } from "@/lib/i18n-messages";
import { cn } from "@/lib/utils";

type AccountTab = "profile" | "password" | "totp" | "passkeys" | "devices";

type AccountUser = {
  nickname: string;
  avatar: string | null;
  email: string;
  role: string;
  emailVerified: boolean;
  totpEnabled: boolean;
};

type AccountWorkspaceProps = {
  user: AccountUser;
  sessions: SessionItem[];
  passkeys: PasskeyItem[];
  trustedDevices: TrustedDeviceItem[];
  error: string | null;
  locale?: Locale;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        accountSettings: "Account settings",
        emailVerified: "Email verified",
        emailUnverified: "Email not verified",
        securityStatus: "Security status",
        hardened: "Hardened",
        incomplete: "Needs attention",
        activeSessions: "Login sessions",
        trustedDevices: "Trusted devices",
        profilePreview: "Avatar preview",
        tabs: [
          { id: "profile" as const, label: "Profile", description: "Avatar, nickname, and email status", icon: UserRound },
          { id: "password" as const, label: "Password security", description: "Update login password", icon: ShieldCheck },
          { id: "totp" as const, label: "Two-factor auth", description: "TOTP verification codes", icon: KeyRound },
          { id: "passkeys" as const, label: "Passkeys", description: "WebAuthn passwordless login", icon: Fingerprint },
          { id: "devices" as const, label: "Login devices", description: "Sessions and trusted devices", icon: Laptop }
        ]
      }
    : {
        accountSettings: "账号设置",
        emailVerified: "邮箱已验证",
        emailUnverified: "邮箱未验证",
        securityStatus: "安全状态",
        hardened: "已加固",
        incomplete: "待完善",
        activeSessions: "登录会话",
        trustedDevices: "可信设备",
        profilePreview: "头像预览",
        tabs: [
          { id: "profile" as const, label: "个人资料", description: "头像、昵称和邮箱状态", icon: UserRound },
          { id: "password" as const, label: "密码安全", description: "修改登录密码", icon: ShieldCheck },
          { id: "totp" as const, label: "双因子验证", description: "TOTP 动态验证码", icon: KeyRound },
          { id: "passkeys" as const, label: "通行密钥", description: "WebAuthn 无密码登录", icon: Fingerprint },
          { id: "devices" as const, label: "登录设备", description: "会话和可信设备", icon: Laptop }
        ]
      };
}

function SecurityPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/72 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function AccountWorkspace({
  user,
  sessions,
  passkeys,
  trustedDevices,
  error,
  locale = "zh-CN"
}: AccountWorkspaceProps) {
  const text = labels(locale);
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const securitySummary = useMemo(
    () => ({
      hardened: user.totpEnabled || passkeys.length > 0,
      activeSessions: sessions.length,
      trustedDevices: trustedDevices.length
    }),
    [passkeys.length, sessions.length, trustedDevices.length, user.totpEnabled]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="overflow-hidden rounded-lg border bg-card/90 shadow-soft">
          <div className="border-b bg-gradient-to-br from-primary/12 via-card to-accent/10 p-5">
            <p className="text-sm font-medium text-primary">{text.accountSettings}</p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{user.nickname}</h1>
            <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{text.profilePreview}</p>
              <UserAvatar
                src={user.avatar}
                name={user.nickname}
                fit="contain"
                className="h-52 w-full rounded-xl border bg-muted/35 text-4xl shadow-inner"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border bg-background/75 px-3 py-1">{user.role}</span>
              <span className="rounded-full border bg-background/75 px-3 py-1">
                {user.emailVerified ? text.emailVerified : text.emailUnverified}
              </span>
            </div>

            <div className="grid gap-3">
              <SecurityPill
                label={text.securityStatus}
                value={securitySummary.hardened ? text.hardened : text.incomplete}
              />
              <SecurityPill label={text.activeSessions} value={String(securitySummary.activeSessions)} />
              <SecurityPill label={text.trustedDevices} value={String(securitySummary.trustedDevices)} />
            </div>
          </div>
        </section>

        <nav className="grid gap-2 rounded-lg border bg-card/90 p-3 shadow-soft">
          {text.tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                    : "border-transparent bg-background/60 hover:border-primary/20 hover:bg-background"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{tab.description}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 space-y-6">
        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {activeTab === "profile" ? (
          <ProfilePanel
            nickname={user.nickname}
            avatar={user.avatar}
            email={user.email}
            emailVerified={user.emailVerified}
          />
        ) : null}
        {activeTab === "password" ? <PasswordPanel /> : null}
        {activeTab === "totp" ? <TotpPanel enabled={user.totpEnabled} /> : null}
        {activeTab === "passkeys" ? <PasskeysPanel passkeys={passkeys} /> : null}
        {activeTab === "devices" ? (
          <div className="space-y-6">
            <SessionsPanel sessions={sessions} />
            <TrustedDevicesPanel devices={trustedDevices} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
