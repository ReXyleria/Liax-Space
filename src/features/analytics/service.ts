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

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      totalArticles,
      totalUsers,
      totalComments,
      totalGuestbook,
      todayVisits,
      popularArticles,
      recentArticles,
      visitLogs
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
      }),
      db.article.findMany({
        where: { status: ArticleStatus.PUBLISHED, deletedAt: null },
        orderBy: { publishedAt: "desc" },
        take: 8,
        select: { id: true, title: true, slug: true, publishedAt: true }
      }),
      db.visitLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
      })
    ]);

    // Build visit trend (last 7 days)
    const trendMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      trendMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const log of visitLogs) {
      const key = log.createdAt.toISOString().slice(0, 10);
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
    const visitTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

    return {
      stats: {
        totalArticles,
        totalUsers,
        totalComments,
        totalGuestbook,
        todayVisits,
        popularArticles,
        recentArticles: recentArticles.map((a) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          publishedAt: a.publishedAt
        })),
        visitTrend
      }
    };
  } catch (error) {
    console.error("Failed to load dashboard stats", error);
    return { stats: null, error: "Dashboard 数据读取失败。" };
  }
}
