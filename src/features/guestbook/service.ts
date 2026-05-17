import { GuestbookStatus, UserRole } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageGuestbook } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import { sendTemplatedMail } from "@/lib/mail";
import { guestbookCreateSchema, guestbookModerationSchema } from "@/features/guestbook/validators";

async function getAdminEmail() {
  return db.user.findFirst({
    where: { role: UserRole.Administer, emailVerified: true },
    orderBy: { createdAt: "asc" },
    select: { email: true, nickname: true }
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function notifyAdmin(message: { nickname: string; email: string; content: string }) {
  const admin = await getAdminEmail();
  if (!admin?.email) {
    throw new Error("未找到可接收留言通知的管理员邮箱。");
  }

  const mailResult = await sendTemplatedMail({
    to: admin.email,
    scene: "guestbookReply",
    variables: {
      nickname: admin.nickname,
      "subscriber.displayName": admin.nickname,
      commenter: message.nickname,
      content: `${message.content}\n\nFrom: ${message.nickname} <${message.email}>`
    },
    respectNotificationToggle: false,
    templateOverride: {
      subject: `重要留言通知 - ${message.nickname}`,
      bodyHtml: `
        <p>收到一条标记为重要的留言。</p>
        <p><strong>昵称：</strong>${escapeHtml(message.nickname)}</p>
        <p><strong>邮箱：</strong>${escapeHtml(message.email)}</p>
        <blockquote style="margin:16px 0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #2563eb">${escapeHtml(message.content)}</blockquote>
      `
    }
  });

  if (!mailResult.ok) {
    throw new Error(mailResult.message);
  }
}

export async function listApprovedGuestbookMessages() {
  if (!isDatabaseConfigured()) {
    return { messages: [], error: "DATABASE_URL 未配置，暂无留言。" };
  }

  return withDatabase(async () => ({
    messages: await db.guestbookMessage.findMany({
      where: { status: GuestbookStatus.APPROVED, notifyOnly: false, deletedAt: null },
      include: {
        user: {
          select: { nickname: true, avatar: true }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    error: null as string | null
  }), { messages: [], error: "留言读取超时或失败。" });
}

export async function createGuestbookMessage(input: unknown, user?: CurrentUser | null) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = guestbookCreateSchema.parse(input);
  const message = await db.guestbookMessage.create({
    data: {
      nickname: parsed.nickname,
      email: parsed.email,
      content: parsed.content,
      notifyOnly: parsed.notifyOnly,
      status: GuestbookStatus.APPROVED,
      userId: user?.id ?? null
    }
  });

  if (parsed.notifyOnly) {
    await notifyAdmin(parsed);
  }

  return message;
}

export async function listAdminGuestbookMessages(user: CurrentUser) {
  assertPermission(canManageGuestbook(user), "你没有权限管理留言板。");

  if (!isDatabaseConfigured()) {
    return { messages: [], error: "DATABASE_URL 未配置，无法读取留言管理列表。" };
  }

  return withDatabase(async () => ({
    messages: await db.guestbookMessage.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: { nickname: true, avatar: true }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    error: null as string | null
  }), { messages: [], error: "留言管理列表读取超时或失败。" });
}

export async function moderateGuestbookMessage(user: CurrentUser, input: unknown) {
  assertPermission(canManageGuestbook(user), "你没有权限管理留言板。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = guestbookModerationSchema.parse(input);
  const existing = await db.guestbookMessage.findUnique({
    where: { id: parsed.id },
    select: { email: true, nickname: true, reply: true }
  });

  const updated = await db.guestbookMessage.update({
    where: { id: parsed.id },
    data: {
      reply: parsed.reply,
      status: parsed.status,
      deletedAt: parsed.status === GuestbookStatus.DELETED ? new Date() : null
    }
  });

  if (existing?.email && parsed.reply && parsed.reply !== existing.reply) {
    const mailResult = await sendTemplatedMail({
      to: existing.email,
      scene: "guestbookReply",
      variables: {
        nickname: existing.nickname,
        "subscriber.displayName": existing.nickname,
        content: parsed.reply
      }
    });
    if (!mailResult.ok) {
      console.error("发送留言板回复通知失败", mailResult.message);
    }
  }

  return updated;
}
