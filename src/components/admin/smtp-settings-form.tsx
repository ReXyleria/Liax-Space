"use client";

import { useActionState } from "react";
import { MailCheck, Save } from "lucide-react";
import { FloatingSettingsSubmit } from "@/components/admin/floating-settings-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import {
  saveSmtpSettingsAction,
  testSmtpSettingsAction,
  type SmtpActionState
} from "@/features/settings/smtp-actions";
import type { Locale } from "@/lib/i18n-messages";

type Settings = Record<string, string>;

const initialState: SmtpActionState = { ok: false, message: "", fieldErrors: {} };

function labels(locale: Locale) {
  return locale === "en"
    ? {
        server: "SMTP server address",
        port: "Port",
        user: "Username",
        pass: "Password",
        from: "From address",
        fromName: "Display name",
        encryption: "Encryption",
        notifications: "Enable mail notifications",
        notificationsDescription: "Used for login alerts, comment replies, guestbook mail, and other system notifications.",
        save: "Save settings",
        saving: "Saving...",
        test: "Send test email",
        testing: "Sending...",
        secretSaved: "Password is saved. Leave blank to keep the current password.",
        none: "None",
        starttls: "STARTTLS",
        sslTls: "SSL/TLS"
      }
    : {
        server: "SMTP 服务器地址",
        port: "端口号",
        user: "用户名",
        pass: "密码",
        from: "发信地址",
        fromName: "显示名称",
        encryption: "加密方式",
        notifications: "启用邮件通知",
        notificationsDescription: "用于登录提醒、评论回复、留言通知和其他系统邮件。",
        save: "保存设置",
        saving: "保存中...",
        test: "发送测试邮件",
        testing: "发送中...",
        secretSaved: "密码已保存，留空表示继续使用当前密码。",
        none: "不加密",
        starttls: "STARTTLS",
        sslTls: "SSL/TLS"
      };
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.[0]) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

function ActionMessage({ state }: { state: SmtpActionState }) {
  if (!state.message) {
    return null;
  }

  return <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>;
}

export function SmtpSettingsForm({
  settings,
  locale = "zh-CN"
}: {
  settings: Settings;
  locale?: Locale;
}) {
  const text = labels(locale);
  const [saveState, saveAction, isSaving] = useActionState<SmtpActionState, FormData>(
    saveSmtpSettingsAction,
    initialState
  );
  const [testState, testAction, isTesting] = useActionState<SmtpActionState, FormData>(
    testSmtpSettingsAction,
    initialState
  );
  const encryption = settings["smtp.encryption"] || "starttls";
  const hasPassword = Boolean(settings["smtp.pass"]);
  const fieldErrors = { ...saveState.fieldErrors, ...testState.fieldErrors };

  return (
    <form action={saveAction} className="space-y-6 pb-24" aria-busy={isSaving || isTesting}>
      <Card>
        <CardHeader className="border-b bg-muted/35">
          <CardTitle>SMTP</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.server} *</span>
            <Input name="smtp.host" defaultValue={settings["smtp.host"] ?? ""} required />
            <FieldError messages={fieldErrors.host} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.port} *</span>
            <Input name="smtp.port" defaultValue={settings["smtp.port"] || "587"} inputMode="numeric" required />
            <FieldError messages={fieldErrors.port} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.user} *</span>
            <Input name="smtp.user" defaultValue={settings["smtp.user"] ?? ""} required />
            <FieldError messages={fieldErrors.user} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.pass} *</span>
            <Input name="smtp.pass" type="password" autoComplete="new-password" placeholder={hasPassword ? "********" : ""} />
            {hasPassword ? <p className="text-xs text-muted-foreground">{text.secretSaved}</p> : null}
            <FieldError messages={fieldErrors.pass} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.from} *</span>
            <Input name="smtp.from" type="email" defaultValue={settings["smtp.from"] ?? ""} required />
            <FieldError messages={fieldErrors.from} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.fromName}</span>
            <Input name="smtp.fromName" defaultValue={settings["smtp.fromName"] ?? ""} />
            <FieldError messages={fieldErrors.fromName} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.encryption}</span>
            <Select
              name="smtp.encryption"
              defaultValue={encryption}
              options={[
                { value: "starttls", label: text.starttls },
                { value: "ssl_tls", label: text.sslTls },
                { value: "none", label: text.none }
              ]}
            />
            <FieldError messages={fieldErrors.encryption} />
          </label>
          <ThemedCheckbox
            name="smtp.notificationsEnabled"
            value="true"
            label={text.notifications}
            description={text.notificationsDescription}
            defaultChecked={(settings["smtp.notificationsEnabled"] ?? "true") !== "false"}
            className="md:self-end"
          />
        </CardContent>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">{text.test}</p>
            <ActionMessage state={testState} />
          </div>
          <Button type="submit" variant="secondary" formAction={testAction} disabled={isTesting || isSaving}>
            <MailCheck className="mr-2 h-4 w-4" />
            {isTesting ? text.testing : text.test}
          </Button>
        </div>
      </Card>

      <FloatingSettingsSubmit
        pending={isSaving}
        message={saveState.message}
        ok={saveState.ok}
        locale={locale}
        label={isSaving ? text.saving : text.save}
        icon={<Save className="h-4 w-4" />}
      />
    </form>
  );
}
