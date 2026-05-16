export type DashboardStats = {
  totalArticles: number;
  totalUsers: number;
  totalComments: number;
  totalGuestbook: number;
  todayVisits: number;
  popularArticles: Array<{ title: string; slug: string; viewCount: number }>;
  recentArticles: Array<{ id: string; title: string; slug: string; publishedAt: Date | null }>;
  visitTrend: Array<{ date: string; count: number }>;
};
