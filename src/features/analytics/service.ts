import { ArticleStatus } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import { assertPermission, canViewAnalytics } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import type { DashboardStats } from "@/features/analytics/types";

type DashboardRangeDays = DashboardStats["rangeDays"];

const ALLOWED_RANGES: DashboardRangeDays[] = [7, 14, 30];

function normalizeRangeDays(value?: number): DashboardRangeDays {
  return ALLOWED_RANGES.includes(value as DashboardRangeDays) ? (value as DashboardRangeDays) : 7;
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDateKeys(startDate: Date, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index);
    return getDateKey(date);
  });
}

export async function getDashboardStats(
  user: CurrentUser,
  rangeDaysInput = 7
): Promise<{ stats: DashboardStats | null; error?: string }> {
  assertPermission(canViewAnalytics(user), "You do not have permission to view analytics.");

  if (!isDatabaseConfigured()) {
    return { stats: null, error: "DATABASE_URL 未配置，无法读取 Dashboard 数据。" };
  }

  try {
    const rangeDays = normalizeRangeDays(rangeDaysInput);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (rangeDays - 1));

    const [
      totalArticles,
      totalUsers,
      totalComments,
      totalGuestbook,
      todayVisits,
      popularArticles,
      recentArticles,
      visitLogs,
      loginSessions
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
        where: { createdAt: { gte: startDate } },
        select: {
          createdAt: true,
          countryCode: true,
          searchEngine: true
        }
      }),
      db.authSession.findMany({
        select: { deviceName: true }
      })
    ]);

    const dateKeys = buildDateKeys(startDate, rangeDays);
    const trendMap = new Map(dateKeys.map((date) => [date, 0]));
    const countryTotals = new Map<string, number>();
    const countryByDate = new Map<string, Map<string, number>>();
    const searchEngineTotals = new Map<string, number>();

    for (const log of visitLogs) {
      const dateKey = getDateKey(log.createdAt);
      const countryCode = (log.countryCode || "Unknown").trim() || "Unknown";
      const searchEngine = (log.searchEngine || "Direct").trim() || "Direct";

      trendMap.set(dateKey, (trendMap.get(dateKey) ?? 0) + 1);
      countryTotals.set(countryCode, (countryTotals.get(countryCode) ?? 0) + 1);
      searchEngineTotals.set(searchEngine, (searchEngineTotals.get(searchEngine) ?? 0) + 1);

      const dailyCountries = countryByDate.get(dateKey) ?? new Map<string, number>();
      dailyCountries.set(countryCode, (dailyCountries.get(countryCode) ?? 0) + 1);
      countryByDate.set(dateKey, dailyCountries);
    }

    const topCountries = Array.from(countryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([countryCode]) => countryCode);

    const visitTrend = dateKeys.map((date) => ({ date, count: trendMap.get(date) ?? 0 }));
    const countryTimeline = dateKeys.map((date) => {
      const dailyCountries = countryByDate.get(date) ?? new Map<string, number>();
      return {
        date,
        countries: topCountries
          .map((countryCode) => ({
            countryCode,
            count: dailyCountries.get(countryCode) ?? 0
          }))
          .sort((a, b) => b.count - a.count)
      };
    });

    const deviceTotals = new Map<string, number>();
    for (const session of loginSessions) {
      const device = session.deviceName || "Unknown";
      const browser = device.includes("·") ? device.split("·")[0].trim() : device;
      deviceTotals.set(browser, (deviceTotals.get(browser) ?? 0) + 1);
    }
    const deviceSources = Array.from(deviceTotals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      stats: {
        rangeDays,
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
        visitTrend,
        countryTimeline,
        deviceSources
      }
    };
  } catch (error) {
    console.error("Failed to load dashboard stats", error);
    return { stats: null, error: "Dashboard 数据读取失败。" };
  }
}
