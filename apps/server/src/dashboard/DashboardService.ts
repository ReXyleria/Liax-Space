import { VisitRepository, type DailyVisitCount, type PopularPage, type VisitDimensionCount } from "../analytics/VisitRepository.js";
import { DashboardRepository, type RecentPublishedArticle } from "./DashboardRepository.js";

export type DashboardRange = 7 | 14 | 30;

export type DashboardSummary = {
  range: DashboardRange;
  totals: {
    articles: number;
    users: number;
    comments: number;
    guestbook: number;
    moments: number;
    visits: number;
    todayVisits: number;
  };
  dailyVisits: DailyVisitCount[];
  countryVisits: VisitDimensionCount[];
  visitDevices: VisitDimensionCount[];
  loginDevices: VisitDimensionCount[];
  recentPublished: RecentPublishedArticle[];
  popularPages: PopularPage[];
};

function startOfToday(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfRange(range: DashboardRange): Date {
  const start = startOfToday();
  start.setDate(start.getDate() - (range - 1));

  return start;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fillDailyVisits(range: DashboardRange, rows: DailyVisitCount[]): DailyVisitCount[] {
  const byDate = new Map(rows.map((row) => [row.date, row.visits]));
  const start = startOfRange(range);

  return Array.from({ length: range }, (_unused, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = formatDateKey(date);

    return {
      date: key,
      visits: byDate.get(key) ?? 0
    };
  }).reverse();
}

function readDeviceType(userAgent: string | null): string {
  const value = userAgent?.toLowerCase() ?? "";

  if (!value) {
    return "unknown";
  }

  if (/bot|crawl|spider|slurp|bingpreview/.test(value)) {
    return "bot";
  }

  if (/ipad|tablet|kindle|silk/.test(value)) {
    return "tablet";
  }

  if (/mobile|android|iphone|ipod|windows phone/.test(value)) {
    return "mobile";
  }

  return "desktop";
}

function groupLoginDevices(rows: Array<{ userAgent: string | null; total: number }>): VisitDimensionCount[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const deviceType = readDeviceType(row.userAgent);
    totals.set(deviceType, (totals.get(deviceType) ?? 0) + row.total);
  }

  return [...totals.entries()]
    .map(([label, visits]) => ({ label, visits }))
    .sort((left, right) => right.visits - left.visits || left.label.localeCompare(right.label));
}

export class DashboardService {
  constructor(
    private readonly dashboardRepository = new DashboardRepository(),
    private readonly visitRepository = new VisitRepository()
  ) {}

  async getSummary(range: DashboardRange): Promise<DashboardSummary> {
    const startDate = startOfRange(range);
    const today = startOfToday();
    const [
      totals,
      visits,
      todayVisits,
      dailyVisits,
      countryVisits,
      visitDevices,
      loginDevices,
      recentPublished,
      popularPages
    ] = await Promise.all([
      this.dashboardRepository.getTotals(),
      this.visitRepository.countSince(startDate),
      this.visitRepository.countSince(today),
      this.visitRepository.listDailyCounts(startDate),
      this.visitRepository.listCountryCounts(startDate),
      this.visitRepository.listDeviceCounts(startDate),
      this.dashboardRepository.listLoginDevices(startDate),
      this.dashboardRepository.listRecentPublishedArticles(),
      this.visitRepository.listPopularPages(startDate)
    ]);

    return {
      countryVisits,
      dailyVisits: fillDailyVisits(range, dailyVisits),
      loginDevices: groupLoginDevices(loginDevices),
      popularPages,
      range,
      recentPublished,
      totals: {
        ...totals,
        todayVisits,
        visits
      },
      visitDevices
    };
  }
}
