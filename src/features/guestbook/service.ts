import { GuestbookStatus, PublicContentTranslationEntity, UserRole } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageGuestbook } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import { sendTemplatedMail } from "@/lib/mail";
import {
  getPublicContentTranslationMap,
  schedulePublicContentTranslation,
  translatedField
} from "@/features/i18n/public-content-translations";
import {
  guestbookCommentCreateSchema,
  guestbookCreateSchema,
  guestbookLikeSchema,
  guestbookModerationSchema
} from "@/features/guestbook/validators";

async function getConsoleEmail() {
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

async function notifyConsole(message: { nickname: string; email: string; content: string }) {
  const console = await getConsoleEmail();
  if (!console?.email) {
    throw new Error("未找到可接收留言通知的管理员邮箱。");
  }

  const mailResult = await sendTemplatedMail({
    to: console.email,
    scene: "guestbookReply",
    variables: {
      nickname: console.nickname,
      "subscriber.displayName": console.nickname,
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

function scheduleMessageTranslation(message: { id: string; content: string; reply: string | null; updatedAt: Date }) {
  schedulePublicContentTranslation({
    entity: PublicContentTranslationEntity.GUESTBOOK_MESSAGE,
    entityId: message.id,
    fields: { content: message.content, reply: message.reply ?? "" },
    sourceUpdatedAt: message.updatedAt
  });
}

function scheduleCommentTranslation(comment: { id: string; content: string; createdAt: Date }) {
  schedulePublicContentTranslation({
    entity: PublicContentTranslationEntity.GUESTBOOK_COMMENT,
    entityId: comment.id,
    fields: { content: comment.content },
    sourceUpdatedAt: comment.createdAt
  });
}

export async function listApprovedGuestbookMessages(locale?: string | null) {
  if (!isDatabaseConfigured()) {
    return { messages: [], error: null as string | null };
  }

  const messages = await withDatabase(
    async () => {
      return db.guestbookMessage.findMany({
        where: { status: GuestbookStatus.APPROVED, notifyOnly: false, deletedAt: null },
        include: {
          user: {
            select: { nickname: true, avatar: true }
          },
          comments: {
            where: { deletedAt: null },
            include: {
              user: { select: { nickname: true, avatar: true } }
            },
            orderBy: { createdAt: "asc" }
          },
          likes: {
            select: { userId: true }
          },
          _count: {
            select: { comments: true, likes: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    },
    []
  );

  if (!messages.length) {
    return { messages: [], error: null as string | null };
  }

  const [messageTranslations, commentTranslations] = await Promise.all([
    getPublicContentTranslationMap(
      PublicContentTranslationEntity.GUESTBOOK_MESSAGE,
      locale ?? "zh-CN",
      messages.map((message) => message.id)
    ),
    getPublicContentTranslationMap(
      PublicContentTranslationEntity.GUESTBOOK_COMMENT,
      locale ?? "zh-CN",
      messages.flatMap((message) => message.comments.map((comment) => comment.id))
    )
  ]);

  return {
    messages: messages.map((message) => ({
      ...message,
      content: translatedField(messageTranslations, message.id, "content", message.content),
      reply: translatedField(messageTranslations, message.id, "reply", message.reply),
      comments: message.comments.map((comment) => ({
        ...comment,
        content: translatedField(commentTranslations, comment.id, "content", comment.content)
      }))
    })),
    error: null as string | null
  };
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

  if (!parsed.notifyOnly) {
    scheduleMessageTranslation(message);
  } else {
    await notifyConsole(parsed);
  }

  return message;
}

export async function listConsoleGuestbookMessages(user: CurrentUser) {
  assertPermission(canManageGuestbook(user), "你没有权限管理留言板。");

  if (!isDatabaseConfigured()) {
    return { messages: [], error: "DATABASE_URL 未配置，无法读取留言管理列表。" };
  }

  return withDatabase(async () => ({
    messages: await db.guestbookMessage.findMany({
      where: {
        deletedAt: null,
        status: { not: GuestbookStatus.DELETED }
      },
      include: {
        user: {
          select: { nickname: true, avatar: true }
        },
        comments: {
          include: {
            user: { select: { nickname: true, avatar: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        _count: {
          select: { comments: true, likes: true }
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
  if (parsed.status === GuestbookStatus.DELETED) {
    return deleteGuestbookMessage(user, parsed.id);
  }

  const existing = await db.guestbookMessage.findUnique({
    where: { id: parsed.id },
    select: { email: true, nickname: true, reply: true }
  });

  const updated = await db.guestbookMessage.update({
    where: { id: parsed.id },
    data: {
      reply: parsed.reply,
      status: parsed.status,
      deletedAt: null
    }
  });

  if (updated.status === GuestbookStatus.APPROVED && !updated.notifyOnly) {
    scheduleMessageTranslation(updated);
  }

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

export async function deleteGuestbookMessage(user: CurrentUser, id: string) {
  assertPermission(canManageGuestbook(user), "你没有权限管理留言板。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const message = await db.guestbookMessage.findUnique({
    where: { id },
    select: {
      id: true,
      comments: { select: { id: true } }
    }
  });

  if (!message) {
    return null;
  }

  const commentIds = message.comments.map((comment) => comment.id);
  await db.$transaction([
    db.publicContentTranslation.deleteMany({
      where: {
        OR: [
          { entity: PublicContentTranslationEntity.GUESTBOOK_MESSAGE, entityId: id },
          { entity: PublicContentTranslationEntity.GUESTBOOK_COMMENT, entityId: { in: commentIds } }
        ]
      }
    }),
    db.publicContentTranslationJob.deleteMany({
      where: {
        OR: [
          { entity: PublicContentTranslationEntity.GUESTBOOK_MESSAGE, entityId: id },
          { entity: PublicContentTranslationEntity.GUESTBOOK_COMMENT, entityId: { in: commentIds } }
        ]
      }
    }),
    db.guestbookMessage.delete({ where: { id } })
  ]);

  return message;
}

export async function createGuestbookComment(input: unknown, user?: CurrentUser | null) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = guestbookCommentCreateSchema.parse(input);
  const message = await db.guestbookMessage.findFirst({
    where: {
      id: parsed.messageId,
      status: GuestbookStatus.APPROVED,
      notifyOnly: false,
      deletedAt: null
    },
    select: { id: true }
  });

  if (!message) {
    throw new Error("这条留言不可评论或不存在。");
  }

  const comment = await db.guestbookComment.create({
    data: {
      messageId: parsed.messageId,
      nickname: parsed.nickname,
      email: parsed.email,
      content: parsed.content,
      userId: user?.id ?? null
    }
  });
  scheduleCommentTranslation(comment);
  return comment;
}

export async function toggleGuestbookLike(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = guestbookLikeSchema.parse(input);
  const message = await db.guestbookMessage.findFirst({
    where: {
      id: parsed.messageId,
      status: GuestbookStatus.APPROVED,
      notifyOnly: false,
      deletedAt: null
    },
    select: { id: true }
  });

  if (!message) {
    throw new Error("这条留言不可点赞或不存在。");
  }

  const existing = await db.guestbookLike.findUnique({
    where: {
      messageId_userId: {
        messageId: parsed.messageId,
        userId: user.id
      }
    }
  });

  if (existing) {
    await db.guestbookLike.delete({
      where: {
        messageId_userId: {
          messageId: parsed.messageId,
          userId: user.id
        }
      }
    });
    return { liked: false };
  }

  await db.guestbookLike.create({
    data: {
      messageId: parsed.messageId,
      userId: user.id
    }
  });
  return { liked: true };
}
