import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { sendTemplatedMail } from "@/lib/mail";
import { assertPermission, canManageMoments, canViewContent } from "@/lib/permissions";
import { momentCommentSchema, momentMutationSchema } from "@/features/moments/validators";

function ensureMomentRuntime() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }
}

export async function listPublicMoments(user: CurrentUser | null) {
  if (!isDatabaseConfigured()) {
    return { moments: [], error: "DATABASE_URL 未配置，无法加载瞬间。" };
  }

  return withDatabase(async () => {
    const moments = await db.moment.findMany({
      where: { deletedAt: null },
      include: {
        author: { select: { nickname: true } },
        likes: { where: { userId: user?.id ?? "__anonymous__" }, select: { userId: true } },
        comments: {
          where: { deletedAt: null },
          include: { user: { select: { nickname: true, avatar: true } } },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100
    });

    return {
      moments: moments
        .filter((moment) => canViewContent(user, moment.visibility))
        .map((moment) => ({
          ...moment,
          likedByViewer: user ? moment.likes.length > 0 : false
        })),
      error: null as string | null
    };
  }, { moments: [], error: "加载瞬间失败。" });
}

export async function listAdminMoments(user: CurrentUser) {
  assertPermission(canManageMoments(user), "你没有权限管理瞬间。");

  if (!isDatabaseConfigured()) {
    return { moments: [], error: "DATABASE_URL 未配置，无法加载瞬间列表。" };
  }

  return withDatabase(async () => ({
    moments: await db.moment.findMany({
      where: { deletedAt: null },
      include: { author: { select: { nickname: true } } },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100
    }),
    error: null as string | null
  }), { moments: [], error: "加载瞬间列表失败。" });
}

export async function createMoment(user: CurrentUser, input: unknown) {
  assertPermission(canManageMoments(user), "你没有权限创建瞬间。");
  ensureMomentRuntime();

  const parsed = momentMutationSchema.parse(input);

  return db.moment.create({
    data: {
      content: parsed.content,
      images: parsed.images,
      visibility: parsed.visibility,
      pinned: parsed.pinned,
      authorId: user.id,
      ...(parsed.createdAt ? { createdAt: parsed.createdAt } : {})
    }
  });
}

export async function updateMoment(user: CurrentUser, input: unknown) {
  assertPermission(canManageMoments(user), "你没有权限编辑瞬间。");
  ensureMomentRuntime();

  const parsed = momentMutationSchema.parse(input);

  if (!parsed.id) {
    throw new Error("缺少瞬间 ID。");
  }

  const existing = await db.moment.findFirst({
    where: { id: parsed.id, deletedAt: null },
    select: { id: true }
  });

  if (!existing) {
    throw new Error("瞬间不存在。");
  }

  return db.moment.update({
    where: { id: parsed.id },
    data: {
      content: parsed.content,
      images: parsed.images,
      visibility: parsed.visibility,
      pinned: parsed.pinned,
      ...(parsed.createdAt ? { createdAt: parsed.createdAt } : {})
    }
  });
}

export async function deleteMoment(user: CurrentUser, id: string) {
  assertPermission(canManageMoments(user), "你没有权限删除瞬间。");
  ensureMomentRuntime();

  if (!id) {
    throw new Error("缺少瞬间 ID。");
  }

  const existing = await db.moment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true }
  });

  if (!existing) {
    throw new Error("瞬间不存在。");
  }

  return db.moment.update({
    where: { id },
    data: { deletedAt: new Date() }
  });
}

export async function toggleMomentLike(user: CurrentUser, momentId: string) {
  ensureMomentRuntime();

  const moment = await db.moment.findFirst({
    where: { id: momentId, deletedAt: null },
    select: { id: true, visibility: true }
  });

  if (!moment || !canViewContent(user, moment.visibility)) {
    throw new Error("未找到瞬间或当前用户不可见。");
  }

  const existing = await db.momentLike.findUnique({
    where: { momentId_userId: { momentId, userId: user.id } }
  });

  if (existing) {
    await db.$transaction([
      db.momentLike.delete({ where: { momentId_userId: { momentId, userId: user.id } } }),
      db.moment.update({
        where: { id: momentId },
        data: { likeCount: { decrement: 1 } }
      })
    ]);
    return { liked: false };
  }

  await db.$transaction([
    db.momentLike.create({ data: { momentId, userId: user.id } }),
    db.moment.update({
      where: { id: momentId },
      data: { likeCount: { increment: 1 } }
    })
  ]);

  return { liked: true };
}

export async function createMomentComment(user: CurrentUser, input: unknown) {
  ensureMomentRuntime();

  const parsed = momentCommentSchema.parse(input);
  const moment = await db.moment.findFirst({
    where: { id: parsed.momentId, deletedAt: null },
    include: { author: { select: { id: true, email: true, nickname: true } } }
  });

  if (!moment || !canViewContent(user, moment.visibility)) {
    throw new Error("未找到瞬间或当前用户不可见。");
  }

  const comment = await db.momentComment.create({
    data: {
      momentId: parsed.momentId,
      userId: user.id,
      content: parsed.content,
      deviceName: parsed.deviceName
    }
  });

  if (moment.author.email && moment.author.id !== user.id) {
    const mailResult = await sendTemplatedMail({
      to: moment.author.email,
      scene: "momentComment",
      variables: {
        nickname: moment.author.nickname,
        commenter: user.nickname,
        content: parsed.content,
        momentCreatedAt: moment.createdAt.toLocaleString("zh-CN"),
        momentName: moment.content.slice(0, 40) || "瞬间",
        momentUrl: "/moments"
      }
    });

    if (!mailResult.ok) {
      console.error("发送瞬间评论通知失败", mailResult.message);
    }
  }

  return comment;
}
