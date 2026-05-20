"use client";

import { useMemo, useState } from "react";
import { Fingerprint, KeyRound, Laptop, ShieldCheck, UserRound } from "lucide-react";
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
import { UserAvatar } from "@/components/ui/user-avatar";
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
        hardened: "Protected",
        incomplete: "Needs attention",
        activeSessions: "Login sessions",
        trustedDevices: "Trusted devices",
        avatarPreview: "Avatar preview",
        tabs: [
          { id: "profile" as const, label: "Profile", description: "Avatar, nickname, and email status", icon: UserRound },
          { id: "password" as const, label: "Password", description: "Update login password", icon: ShieldCheck },
          { id: "totp" as const, label: "2FA", description: "Authenticator and recovery codes", icon: KeyRound },
          { id: "passkeys" as const, label: "Passkeys", description: "Passwordless login keys", icon: Fingerprint },
          { id: "devices" as const, label: "Devices", description: "Sessions and trusted devices", icon: Laptop }
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
        avatarPreview: "头像预览",
        tabs: [
          { id: "profile" as const, label: "个人资料", description: "头像、昵称和邮箱状态", icon: UserRound },
          { id: "password" as const, label: "密码", description: "修改登录密码", icon: ShieldCheck },
          { id: "totp" as const, label: "双因素验证", description: "动态验证码和恢复码", icon: KeyRound },
          { id: "passkeys" as const, label: "通行密钥", description: "免密码登录密钥", icon: Fingerprint },
          { id: "devices" as const, label: "设备", description: "会话和可信设备", icon: Laptop }
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
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border bg-card/90 shadow-soft">
        <div className="grid gap-5 bg-gradient-to-br from-primary/12 via-card to-accent/10 p-5 lg:grid-cols-[170px_minmax(0,1fr)_minmax(300px,420px)] lg:items-center">
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{text.avatarPreview}</p>
            <UserAvatar
              src={user.avatar}
              name={user.nickname}
              fit="contain"
              className="h-36 w-full rounded-xl border bg-muted/35 text-4xl shadow-inner"
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{text.accountSettings}</p>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{user.nickname}</h1>
            <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border bg-background/75 px-3 py-1">{user.role}</span>
              <span className="rounded-full border bg-background/75 px-3 py-1">
                {user.emailVerified ? text.emailVerified : text.emailUnverified}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <SecurityPill
              label={text.securityStatus}
              value={securitySummary.hardened ? text.hardened : text.incomplete}
            />
            <SecurityPill label={text.activeSessions} value={String(securitySummary.activeSessions)} />
            <SecurityPill label={text.trustedDevices} value={String(securitySummary.trustedDevices)} />
          </div>
        </div>

        <div className="border-t bg-muted/20 p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
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
                      : "border-transparent bg-background/70 hover:border-primary/20 hover:bg-background"
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
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="min-w-0">
        {activeTab === "profile" ? (
          <ProfilePanel
            nickname={user.nickname}
            avatar={user.avatar}
            email={user.email}
            emailVerified={user.emailVerified}
            locale={locale}
          />
        ) : null}
        {activeTab === "password" ? <PasswordPanel locale={locale} /> : null}
        {activeTab === "totp" ? <TotpPanel enabled={user.totpEnabled} locale={locale} /> : null}
        {activeTab === "passkeys" ? <PasskeysPanel passkeys={passkeys} locale={locale} /> : null}
        {activeTab === "devices" ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <SessionsPanel sessions={sessions} locale={locale} />
            <TrustedDevicesPanel devices={trustedDevices} locale={locale} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
