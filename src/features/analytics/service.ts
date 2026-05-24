import { ArticleStatus } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
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

function getBrowserName(deviceName: string | null | undefined) {
  const device = deviceName || "Unknown";
  return device.includes("·") ? device.split("·")[0].trim() : device;
}

function rowCount(value: bigint | number | string) {
  return Number(value);
}

function rowDateKey(value: Date | string) {
  return value instanceof Date ? getDateKey(value) : String(value).slice(0, 10);
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
      visitTrendRows,
      countryRows,
      loginEvents
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
      db.$queryRaw<Array<{ date: Date | string; count: bigint | number | string }>>`
        SELECT DATE(createdAt) AS date, COUNT(*) AS count
        FROM VisitLog
        WHERE createdAt >= ${startDate}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,
      db.$queryRaw<Array<{ date: Date | string; countryCode: string | null; count: bigint | number | string }>>`
        SELECT
          DATE(createdAt) AS date,
          COALESCE(NULLIF(TRIM(countryCode), ''), 'Unknown') AS countryCode,
          COUNT(*) AS count
        FROM VisitLog
        WHERE createdAt >= ${startDate}
        GROUP BY DATE(createdAt), COALESCE(NULLIF(TRIM(countryCode), ''), 'Unknown')
      `,
      withDatabase(() => db.loginEvent.groupBy({
        by: ["deviceName"],
        where: { createdAt: { gte: startDate } },
        _count: { _all: true }
      }), [] as Array<{ deviceName: string | null; _count: { _all: number } }>)
    ]);

    const dateKeys = buildDateKeys(startDate, rangeDays);
    const trendMap = new Map(dateKeys.map((date) => [date, 0]));
    const countryTotals = new Map<string, number>();
    const countryByDate = new Map<string, Map<string, number>>();

    for (const row of visitTrendRows) {
      trendMap.set(rowDateKey(row.date), rowCount(row.count));
    }

    for (const row of countryRows) {
      const dateKey = rowDateKey(row.date);
      const countryCode = (row.countryCode || "Unknown").trim() || "Unknown";
      const count = rowCount(row.count);

      countryTotals.set(countryCode, (countryTotals.get(countryCode) ?? 0) + count);

      const dailyCountries = countryByDate.get(dateKey) ?? new Map<string, number>();
      dailyCountries.set(countryCode, (dailyCountries.get(countryCode) ?? 0) + count);
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
    for (const event of loginEvents) {
      const browser = getBrowserName(event.deviceName);
      deviceTotals.set(browser, (deviceTotals.get(browser) ?? 0) + event._count._all);
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
