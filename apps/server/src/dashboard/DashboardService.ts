import { VisitRepository, type PopularPage, type VisitDimensionCount } from "../analytics/VisitRepository.js";
import { DashboardRepository, type LoginAuditEvent, type RecentPublishedArticle } from "./DashboardRepository.js";

export type DashboardRange = 7 | 14 | 30;

export type DashboardSummary = {
  range: DashboardRange;
  totals: {
    articles: number;
    users: number;
    comments: number;
    guestbook: number;
    moments: number;
    loginEvents: number;
    loginUsers: number;
  };
  loginCountries: VisitDimensionCount[];
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

function aggregateLoginDimension(
  events: LoginAuditEvent[],
  selector: (event: LoginAuditEvent) => string
): VisitDimensionCount[] {
  const totals = new Map<string, number>();

  for (const event of events) {
    const label = selector(event).trim() || "Unknown";
    totals.set(label, (totals.get(label) ?? 0) + 1);
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
      loginTotals,
      loginEvents,
      recentPublished,
      popularPages
    ] = await Promise.all([
      this.dashboardRepository.getTotals(),
      this.dashboardRepository.getLoginTotals(startDate),
      this.dashboardRepository.listLoginAuditEvents(startDate),
      this.dashboardRepository.listRecentPublishedArticles(),
      this.visitRepository.listPopularPages(startDate)
    ]);

    return {
      loginCountries: aggregateLoginDimension(loginEvents, (event) => event.country),
      loginDevices: aggregateLoginDimension(loginEvents, (event) => event.operatingSystem),
      popularPages,
      range,
      recentPublished,
      totals: {
        ...totals,
        loginEvents: loginTotals.loginEvents,
        loginUsers: loginTotals.loginUsers
      }
    };
  }
}
