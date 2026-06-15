import { httpClient } from "./httpClient";

export type DashboardRange = 7 | 14 | 30;

export type DashboardMetric = {
  date?: string;
  label?: string;
  path?: string;
  locale?: string | null;
  visits: number;
};

export type DashboardArticle = {
  articleId: number;
  locale: string;
  title: string;
  slug: string;
  publishedAt: string | null;
};

export type DashboardSummary = {
  range: DashboardRange;
  totals: {
    articles: number;
    users: number;
    comments: number;
    guestbook: number;
    moments: number;
  };
  visitDevices: DashboardMetric[];
  recentPublished: DashboardArticle[];
  popularPages: DashboardMetric[];
};

export type DashboardResponse = {
  dashboard: DashboardSummary;
};

export const dashboardApi = {
  getDashboard(range: DashboardRange): Promise<DashboardResponse> {
    return httpClient.get<DashboardResponse>(`/admin/dashboard?range=${range}`);
  }
};
