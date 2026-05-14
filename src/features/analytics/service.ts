import { ArticleStatus } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import { assertPermission, canViewAnalytics } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import type { DashboardStats } from "@/features/analytics/types";

export async function getDashboardStats(user: CurrentUser): Promise<{ stats: DashboardStats | null; error?: string }> {
  assertPermission(canViewAnalytics(user), "You do not have permission to view analytics.");

  if (!isDatabaseConfigured()) {
    return { stats: null, error: "DATABASE_URL 未配置，无法读取 Dashboard 数据。" };
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalArticles,
      totalUsers,
      totalComments,
      totalGuestbook,
      todayVisits,
      popularArticles
    ] = await Promise.all([
      db.article.count({ where: { deletedAt: null } }),
      db.user.count(),
      db.comment.count({ where: { deletedAt: null } }),
      db.guestbookMessage.count({ where: { deletedAt: null } }),
      db.visitLog.count({ where: { createdAt: { gte: today } } }),
      db.article.findMany({
        where: { status: ArticleStatus.PUBLISHED, deletedAt: null },
        orderBy: { viewCount: "desc" },
        take: 5,
        select: { title: true, slug: true, viewCount: true }
      })
    ]);

    return {
      stats: {
        totalArticles,
        totalUsers,
        totalComments,
        totalGuestbook,
        todayVisits,
        popularArticles
      }
    };
  } catch (error) {
    console.error("Failed to load dashboard stats", error);
    return { stats: null, error: "Dashboard 数据读取失败。" };
  }
}
