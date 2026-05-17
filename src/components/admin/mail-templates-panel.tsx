"use client";

import { useActionState, useMemo, useState } from "react";
import { MailSendStatus, MailTemplateScene } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  testMailTemplateAction,
  updateMailTemplateAction,
  type MailTemplateActionState
} from "@/features/mail/actions";
import { mailVariables, sampleVariables } from "@/features/mail/templates";
import type { Locale } from "@/lib/i18n-messages";

type TemplateItem = {
  scene: MailTemplateScene;
  category: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
};

type LogItem = {
  id: string;
  scene: MailTemplateScene;
  to: string;
  subject: string | null;
  status: MailSendStatus;
  error: string | null;
  createdAtLabel: string;
};

const initialState: MailTemplateActionState = {
  ok: false,
  message: ""
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        subject: "Subject",
        bodyHtml: "HTML body",
        save: "Save",
        saving: "Saving...",
        send: "Test send",
        sending: "Sending...",
        preview: "Preview",
        hidePreview: "Hide preview",
        recentSendLogs: "Recent send logs",
        noSendLogs: "No mail send logs yet.",
        to: "To",
        subjectLog: "Subject"
      }
    : {
        subject: "主题",
        bodyHtml: "HTML 内容",
        save: "保存",
        saving: "保存中...",
        send: "测试发送",
        sending: "发送中...",
        preview: "预览",
        hidePreview: "隐藏预览",
        recentSendLogs: "最近发送日志",
        noSendLogs: "暂无邮件发送日志。",
        to: "收件人",
        subjectLog: "主题"
      };
}

function categoryLabel(locale: Locale, category: string) {
  if (locale !== "en") {
    switch (category) {
      case "Comments":
        return "评论";
      case "Security":
        return "安全";
      case "Replies":
        return "回复";
      case "Auth":
        return "认证";
      default:
        return category;
    }
  }

  return category;
}

function templateLabel(locale: Locale, scene: MailTemplateScene) {
  if (locale === "en") {
    switch (scene) {
      case MailTemplateScene.MOMENT_COMMENT:
        return { name: "Moment received a new comment", description: "Sent to the author when a logged-in user comments on their moment." };
      case MailTemplateScene.LOGIN_ALERT:
        return { name: "New device login", description: "Sent when a new device label logs in." };
      case MailTemplateScene.COMMENT_REPLY:
        return { name: "Someone replied to me", description: "Sent when a comment or message receives a reply." };
      case MailTemplateScene.EMAIL_VERIFY:
        return { name: "Email verification", description: "Sent with an email verification code." };
      case MailTemplateScene.REGISTER_CODE:
        return { name: "Registration verification", description: "Sent during registration." };
      case MailTemplateScene.PASSWORD_RESET:
        return { name: "Password reset by email", description: "Sent when a user requests password reset by email." };
      case MailTemplateScene.CUSTOM_PAGE_COMMENT:
        return { name: "Custom page received a new comment", description: "Sent when a custom page receives a comment." };
      case MailTemplateScene.ARTICLE_COMMENT:
        return { name: "Article received a new comment", description: "Sent when an article receives a comment." };
      case MailTemplateScene.GUESTBOOK_REPLY:
        return { name: "Guestbook reply", description: "Sent when a guestbook message receives a reply." };
    }
  }

  switch (scene) {
    case MailTemplateScene.MOMENT_COMMENT:
      return { name: "瞬间收到新评论", description: "当登录用户评论你的瞬间时发送给作者。" };
    case MailTemplateScene.LOGIN_ALERT:
      return { name: "新设备登录提醒", description: "当新的设备标签登录时发送。" };
    case MailTemplateScene.COMMENT_REPLY:
      return { name: "有人回复我", description: "当评论或留言收到回复时发送。" };
    case MailTemplateScene.EMAIL_VERIFY:
      return { name: "邮箱验证", description: "发送邮箱验证码。" };
    case MailTemplateScene.REGISTER_CODE:
      return { name: "注册验证", description: "注册时发送。" };
    case MailTemplateScene.PASSWORD_RESET:
      return { name: "邮箱重置密码", description: "当用户请求通过邮箱重置密码时发送。" };
    case MailTemplateScene.CUSTOM_PAGE_COMMENT:
      return { name: "自定义页面收到新评论", description: "当自定义页面收到评论时发送。" };
    case MailTemplateScene.ARTICLE_COMMENT:
      return { name: "文章收到新评论", description: "当文章收到评论时发送。" };
    case MailTemplateScene.GUESTBOOK_REPLY:
      return { name: "留言回复", description: "当留言收到回复时发送。" };
  }
}

function renderPreview(template: string) {
  const variables = sampleVariables();
  return template.replace(/\$\{([a-zA-Z0-9_.]+)\}/g, (_, key: string) => variables[key as keyof typeof variables] ?? "");
}

function ActionMessage({ state }: { state: MailTemplateActionState }) {
  if (!state.message) {
    return null;
  }

  return <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>;
}

function MailTemplateEditor({ template, locale }: { template: TemplateItem; locale: Locale }) {
  const text = labels(locale);
  const display = templateLabel(locale, template.scene);
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveState, saveAction, isSaving] = useActionState<MailTemplateActionState, FormData>(
    updateMailTemplateAction,
    initialState
  );
  const [testState, testAction, isTesting] = useActionState<MailTemplateActionState, FormData>(
    testMailTemplateAction,
    initialState
  );

  return (
    <Card className="p-5">
      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="scene" value={template.scene} />
        <div>
          <h3 className="text-lg font-semibold">{display.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{display.description}</p>
        </div>
        <label className="space-y-2 text-sm">
          <span className="font-medium">{text.subject}</span>
          <Input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">{text.bodyHtml}</span>
          <Textarea
            name="bodyHtml"
            value={bodyHtml}
            onChange={(event) => setBodyHtml(event.target.value)}
            className="min-h-60 font-mono text-xs"
          />
        </label>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {mailVariables.map((variable) => (
            <span key={variable} className="rounded-full bg-muted px-2 py-1">${`{${variable}}`}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isSaving}>{isSaving ? text.saving : text.save}</Button>
          <Button type="submit" variant="secondary" formAction={testAction} disabled={isTesting}>
            {isTesting ? text.sending : text.send}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setPreviewOpen((current) => !current)}>
            {previewOpen ? text.hidePreview : text.preview}
          </Button>
        </div>
        <ActionMessage state={saveState} />
        <ActionMessage state={testState} />
      </form>
      {previewOpen ? (
        <div className="mt-5 rounded-md border bg-muted/35 p-4">
          <p className="mb-3 text-sm font-medium">{renderPreview(subject)}</p>
          <div className="rounded-md bg-white p-3" dangerouslySetInnerHTML={{ __html: renderPreview(bodyHtml) }} />
        </div>
      ) : null}
    </Card>
  );
}

export function MailTemplatesPanel({
  templates,
  logs,
  showTemplates = true,
  showLogs = true,
  locale = "zh-CN"
}: {
  templates: TemplateItem[];
  logs: LogItem[];
  showTemplates?: boolean;
  showLogs?: boolean;
  locale?: Locale;
}) {
  const text = labels(locale);
  const grouped = useMemo(() => {
    return templates.reduce<Record<string, TemplateItem[]>>((acc, template) => {
      acc[template.category] = [...(acc[template.category] ?? []), template];
      return acc;
    }, {});
  }, [templates]);

  return (
    <div className="space-y-6">
      {showTemplates
        ? Object.entries(grouped).map(([category, items]) => (
            <section key={category} className="space-y-3">
              <h2 className="text-xl font-semibold">{categoryLabel(locale, category)}</h2>
              <div className="grid gap-4">
                {items.map((template) => (
                  <MailTemplateEditor key={template.scene} template={template} locale={locale} />
                ))}
              </div>
            </section>
          ))
        : null}

      {showLogs ? (
        <Card className="p-5">
          <h2 className="text-xl font-semibold">{text.recentSendLogs}</h2>
          <div className="mt-4 space-y-2">
            {logs.length ? (
              logs.map((log) => (
                <div key={log.id} className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{log.scene}</span>
                    <span
                      className={
                        log.status === MailSendStatus.SENT
                          ? "text-emerald-600"
                          : log.status === MailSendStatus.SKIPPED
                            ? "text-amber-600"
                            : "text-destructive"
                      }
                    >
                      {log.status}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {text.to}: {log.to} · {log.createdAtLabel}
                  </p>
                  {log.subject ? <p className="mt-1 text-muted-foreground">{text.subjectLog}: {log.subject}</p> : null}
                  {log.error ? <p className="mt-1 text-destructive">{log.error}</p> : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{text.noSendLogs}</p>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
