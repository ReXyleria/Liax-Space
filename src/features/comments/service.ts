import { CommentStatus } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageComments } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import { sendTemplatedMail } from "@/lib/mail";
import { commentCreateSchema, commentStatusSchema, muteUserSchema, MUTE_DURATIONS } from "@/features/comments/validators";

export async function listArticleComments(articleId: string) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return withDatabase(() => db.comment.findMany({
      where: { articleId, deletedAt: null },
      include: { user: { select: { nickname: true, avatar: true } } },
      orderBy: [{ pinned: "desc" }, { createdAt: "asc" }]
    }), []);
}

export async function createComment(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  if (user.mutedUntil && new Date(user.mutedUntil) > new Date()) {
    const until = new Date(user.mutedUntil);
    const isIndefinite = until.getFullYear() >= 2090;
    throw new Error(
      isIndefinite
        ? "你已被永久禁言，无法发表评论。"
        : `你已被禁言至 ${until.toLocaleString("zh-CN")}，暂时无法发表评论。`
    );
  }

  const parsed = commentCreateSchema.parse(input);
  const article = await db.article.findFirst({
    where: { id: parsed.articleId, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      allowComments: true,
      author: {
        select: {
          email: true,
          nickname: true
        }
      }
    }
  });

  if (!article || !article.allowComments) {
    throw new Error("该文章不允许评论。");
  }

  const comment = await db.comment.create({
    data: {
      articleId: parsed.articleId,
      userId: user.id,
      parentId: parsed.parentId || null,
      content: parsed.content,
      deviceName: parsed.deviceName,
      status: CommentStatus.APPROVED
    }
  });

  if (parsed.parentId) {
    const parent = await db.comment.findUnique({
      where: { id: parsed.parentId },
      include: {
        user: { select: { email: true, nickname: true } },
        article: { select: { title: true } }
      }
    });

    if (parent?.user.email && parent.user.email !== user.email) {
      const mailResult = await sendTemplatedMail({
        to: parent.user.email,
        scene: "commentReply",
        variables: {
          nickname: parent.user.nickname,
          "subscriber.displayName": parent.user.nickname,
          commenter: user.nickname,
          articleTitle: parent.article.title,
          content: parsed.content
        }
      });
      if (!mailResult.ok) {
        console.error("发送评论回复通知失败", mailResult.message);
      }
    }
  } else if (article.author.email && article.author.email !== user.email) {
    const mailResult = await sendTemplatedMail({
      to: article.author.email,
      scene: "articleComment",
      variables: {
        nickname: article.author.nickname,
        commenter: user.nickname,
        content: parsed.content,
        articleTitle: article.title,
        articleUrl: `/articles/${article.slug}`
      }
    });
    if (!mailResult.ok) {
      console.error("发送文章评论通知失败", mailResult.message);
    }
  }

  return comment;
}

export async function listAdminComments(user: CurrentUser) {
  assertPermission(canManageComments(user), "你没有权限管理评论。");

  if (!isDatabaseConfigured()) {
    return { comments: [], error: "DATABASE_URL 未配置，无法读取评论管理列表。" };
  }

  return withDatabase(async () => {
    return {
      comments: await db.comment.findMany({
        where: { deletedAt: null },
        include: {
          article: { select: { id: true, title: true, slug: true } },
          user: { select: { id: true, nickname: true, email: true, avatar: true, mutedUntil: true } }
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }]
      }),
      error: null as string | null
    };
  }, { comments: [], error: "评论读取超时或失败。" });
}

export async function toggleCommentPin(user: CurrentUser, commentId: string) {
  assertPermission(canManageComments(user), "你没有权限管理评论。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }
  const comment = await db.comment.findUnique({ where: { id: commentId }, select: { pinned: true } });
  if (!comment) {
    throw new Error("评论不存在。");
  }
  return db.comment.update({ where: { id: commentId }, data: { pinned: !comment.pinned } });
}

export async function updateCommentStatus(user: CurrentUser, input: unknown) {
  assertPermission(canManageComments(user), "你没有权限管理评论。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }
  const parsed = commentStatusSchema.parse(input);
  return db.comment.update({
    where: { id: parsed.id },
    data: {
      status: parsed.status,
      deletedAt: parsed.status === CommentStatus.DELETED ? new Date() : null
    }
  });
}

export async function muteUser(user: CurrentUser, input: unknown) {
  assertPermission(canManageComments(user), "你没有权限管理评论。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }
  const parsed = muteUserSchema.parse(input);

  const durationMs = MUTE_DURATIONS[parsed.duration] ?? 0;

  let mutedUntil: Date | null;
  if (parsed.duration === "permanent") {
    mutedUntil = new Date("2099-12-31T23:59:59.999Z");
  } else {
    mutedUntil = new Date(Date.now() + durationMs);
  }

  await db.user.update({
    where: { id: parsed.userId },
    data: { mutedUntil }
  });

  return mutedUntil;
}
