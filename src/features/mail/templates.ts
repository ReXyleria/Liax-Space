import { MailTemplateScene } from "@prisma/client";

export type MailTemplateDefinition = {
  scene: MailTemplateScene;
  key: string;
  category: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
};

const shellStart = `
<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="padding:22px 24px;border-bottom:1px solid #e2e8f0">
      <strong style="font-size:16px">\${site.title}</strong>
    </div>
    <div style="padding:24px;line-height:1.7;font-size:15px">
`;

const shellEnd = `
    </div>
    <div style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px">
      <a href="\${site.url}" style="color:#2563eb;text-decoration:none">\${site.url}</a>
    </div>
  </div>
</div>`;

function html(content: string) {
  return `${shellStart}${content}${shellEnd}`;
}

export const mailTemplateDefinitions: MailTemplateDefinition[] = [
  {
    scene: MailTemplateScene.MOMENT_COMMENT,
    key: "momentComment",
    category: "Comments",
    name: "Moment received a new comment",
    description: "Sent to the author when a logged-in user comments on their moment.",
    subject: "${commenter} commented on your moment from ${momentCreatedAt} · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p><strong>\${commenter}</strong> commented on your moment <strong>\${momentName}</strong>.</p>
      <blockquote style="margin:16px 0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #2563eb">\${content}</blockquote>
      <p><a href="\${momentUrl}" style="color:#2563eb">Open the moment</a></p>
    `)
  },
  {
    scene: MailTemplateScene.LOGIN_ALERT,
    key: "loginAlert",
    category: "Security",
    name: "New device login",
    description: "Sent when a new device label logs in.",
    subject: "New login on ${deviceName} · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p>Your account signed in at <strong>\${loginTime}</strong>.</p>
      <p>Device: <strong>\${deviceName}</strong><br />IP: <strong>\${loginIp}</strong></p>
      <p>If this was not you, change your password and review login devices.</p>
    `)
  },
  {
    scene: MailTemplateScene.COMMENT_REPLY,
    key: "commentReply",
    category: "Replies",
    name: "Someone replied to me",
    description: "Sent when a comment or message receives a reply.",
    subject: "${commenter} replied to you · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${subscriber.displayName},</p>
      <p><strong>\${commenter}</strong> replied to you:</p>
      <blockquote style="margin:16px 0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #2563eb">\${content}</blockquote>
    `)
  },
  {
    scene: MailTemplateScene.EMAIL_VERIFY,
    key: "emailVerify",
    category: "Auth",
    name: "Email verification",
    description: "Sent with an email verification code.",
    subject: "Verify your email · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p>Your verification code is:</p>
      <p style="font-size:28px;letter-spacing:4px;font-weight:700">\${code}</p>
    `)
  },
  {
    scene: MailTemplateScene.REGISTER_CODE,
    key: "registerCode",
    category: "Auth",
    name: "Registration verification",
    description: "Sent during registration.",
    subject: "Registration code · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p>Your registration verification code is:</p>
      <p style="font-size:28px;letter-spacing:4px;font-weight:700">\${code}</p>
    `)
  },
  {
    scene: MailTemplateScene.LOGIN_CODE,
    key: "loginCode",
    category: "Auth",
    name: "Login verification code",
    description: "Sent when a new or untrusted device needs email second-factor verification.",
    subject: "Login verification code 路 ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p>Your login verification code is:</p>
      <p style="font-size:28px;letter-spacing:4px;font-weight:700">\${code}</p>
      <p>This code is valid for a short time. If you did not try to sign in, review your account security.</p>
    `)
  },
  {
    scene: MailTemplateScene.PASSWORD_RESET,
    key: "passwordReset",
    category: "Auth",
    name: "Password reset by email",
    description: "Sent when a user requests password reset by email.",
    subject: "Reset your password · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p>Use this link to reset your password:</p>
      <p><a href="\${resetUrl}" style="color:#2563eb">Reset password</a></p>
    `)
  },
  {
    scene: MailTemplateScene.CUSTOM_PAGE_COMMENT,
    key: "pageComment",
    category: "Comments",
    name: "Custom page received a new comment",
    description: "Sent when a custom page receives a comment.",
    subject: "${commenter} commented on ${pageTitle} · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p><strong>\${commenter}</strong> commented on <a href="\${pageUrl}" style="color:#2563eb">\${pageTitle}</a>.</p>
      <blockquote style="margin:16px 0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #2563eb">\${content}</blockquote>
    `)
  },
  {
    scene: MailTemplateScene.ARTICLE_COMMENT,
    key: "articleComment",
    category: "Comments",
    name: "Article received a new comment",
    description: "Sent when an article receives a comment.",
    subject: "${commenter} commented on ${articleTitle} · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p><strong>\${commenter}</strong> commented on <a href="\${articleUrl}" style="color:#2563eb">\${articleTitle}</a>.</p>
      <blockquote style="margin:16px 0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #2563eb">\${content}</blockquote>
    `)
  },
  {
    scene: MailTemplateScene.GUESTBOOK_REPLY,
    key: "guestbookReply",
    category: "Replies",
    name: "Guestbook reply",
    description: "Sent when a guestbook message receives a reply.",
    subject: "Your message received a reply · ${site.title}",
    bodyHtml: html(`
      <p>Hello \${nickname},</p>
      <p>Your message received a reply:</p>
      <blockquote style="margin:16px 0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #2563eb">\${content}</blockquote>
    `)
  }
];

export const mailSceneKeyToDbScene = Object.fromEntries(
  mailTemplateDefinitions.map((definition) => [definition.key, definition.scene])
) as Record<string, MailTemplateScene>;

export const mailDbSceneToDefinition = new Map(
  mailTemplateDefinitions.map((definition) => [definition.scene, definition])
);

export const mailVariables = [
  "site.title",
  "site.url",
  "subscriber.displayName",
  "nickname",
  "commenter",
  "content",
  "articleTitle",
  "articleUrl",
  "momentCreatedAt",
  "momentName",
  "momentUrl",
  "pageTitle",
  "pageUrl",
  "code",
  "resetUrl",
  "loginTime",
  "loginIp",
  "deviceName"
];

export function sampleVariables() {
  return {
    "site.title": "Liax-Space",
    "site.url": "http://localhost:3000",
    "subscriber.displayName": "Subscriber",
    nickname: "Owner",
    commenter: "Reader",
    content: "This is a sample notification body.",
    articleTitle: "A thoughtful article",
    articleUrl: "http://localhost:3000/zh-CN/articles/sample",
    momentCreatedAt: "2026-05-01 10:00",
    momentName: "Morning note",
    momentUrl: "http://localhost:3000/zh-CN/moments",
    pageTitle: "About",
    pageUrl: "http://localhost:3000/about",
    code: "123456",
    resetUrl: "http://localhost:3000/reset-password",
    loginTime: "2026-05-01 10:00",
    loginIp: "127.0.0.1",
    deviceName: "Chrome on Windows"
  };
}
