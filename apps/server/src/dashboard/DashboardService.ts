import { normalizeDeviceType } from "../analytics/deviceType.js";
import { VisitRepository, type PopularPage, type VisitDimensionCount } from "../analytics/VisitRepository.js";
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
  };
  visitDevices: VisitDimensionCount[];
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

function normalizeVisitDevices(rows: VisitDimensionCount[]): VisitDimensionCount[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const deviceType = normalizeDeviceType(row.label);
    totals.set(deviceType, (totals.get(deviceType) ?? 0) + row.visits);
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
    const [
      totals,
      visitDevices,
      recentPublished,
      popularPages
    ] = await Promise.all([
      this.dashboardRepository.getTotals(),
      this.visitRepository.listDeviceCounts(startDate),
      this.dashboardRepository.listRecentPublishedArticles(),
      this.visitRepository.listPopularPages(startDate)
    ]);

    return {
      popularPages,
      range,
      recentPublished,
      totals,
      visitDevices: normalizeVisitDevices(visitDevices)
    };
  }
}
