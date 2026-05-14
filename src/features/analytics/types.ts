export type DashboardStats = {
  totalArticles: number;
  totalUsers: number;
  totalComments: number;
  totalGuestbook: number;
  todayVisits: number;
  popularArticles: Array<{ title: string; slug: string; viewCount: number }>;
};
