import { GuestbookStatus } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageGuestbook } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import { sendTemplatedMail } from "@/lib/mail";
import { guestbookCreateSchema, guestbookModerationSchema } from "@/features/guestbook/validators";

async function guestbookRequiresApproval() {
  if (!isDatabaseConfigured()) {
    return true;
  }

  return withDatabase(async () => {
    const setting = await db.setting.findUnique({ where: { key: "guestbook.requireApproval" } });
    return setting?.value !== "false";
  }, true);
}

export async function listApprovedGuestbookMessages() {
  if (!isDatabaseConfigured()) {
    return { messages: [], error: "DATABASE_URL 未配置，暂无留言。" };
  }

  return withDatabase(async () => {
    return {
      messages: await db.guestbookMessage.findMany({
        where: { status: GuestbookStatus.APPROVED, deletedAt: null },
        orderBy: { createdAt: "desc" }
      }),
      error: null as string | null
    };
  }, { messages: [], error: "留言读取超时或失败。" });
}

export async function createGuestbookMessage(input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }
  const parsed = guestbookCreateSchema.parse(input);
  return db.guestbookMessage.create({
    data: {
      ...parsed,
      status: (await guestbookRequiresApproval()) ? GuestbookStatus.PENDING : GuestbookStatus.APPROVED
    }
  });
}

export async function listAdminGuestbookMessages(user: CurrentUser) {
  assertPermission(canManageGuestbook(user), "你没有权限管理留言板。");

  if (!isDatabaseConfigured()) {
    return { messages: [], error: "DATABASE_URL 未配置，无法读取留言管理列表。" };
  }

  return withDatabase(async () => {
    return {
      messages: await db.guestbookMessage.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" }
      }),
      error: null as string | null
    };
  }, { messages: [], error: "留言管理列表读取超时或失败。" });
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
