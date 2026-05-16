import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, FileText, MessageSquare, MessageSquareText, Pencil, Users } from "lucide-react";
import { DashboardEcharts } from "@/components/admin/dashboard-echarts";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardStats } from "@/features/analytics/service";
import { requireAdminAccess } from "@/lib/admin-guard";
import { canManageArticles, canViewAnalytics } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  icon: Icon,
  gradient
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}) {
  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <div className={`absolute inset-0 opacity-[0.03] ${gradient}`} />
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{value.toLocaleString()}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${gradient} bg-opacity-10`}>
            <Icon className="h-5 w-5 text-foreground/70" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "未发布";
  }

  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function parseRange(range?: string) {
  const value = Number(range);
  return value === 14 || value === 30 ? value : 7;
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const user = await requireAdminAccess("/admin");

  if (!canViewAnalytics(user)) {
    redirect(canManageArticles(user) ? "/admin/articles" : "/admin/account?section=profile");
  }

  const params = (await searchParams) ?? {};
  const rangeDays = parseRange(params.range);
  const { stats, error } = await getDashboardStats(user, rangeDays);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">站点数据概览</p>
        </div>
        {stats ? (
          <Link
            href="/admin/articles/new"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <FileText className="h-4 w-4" />
            新建文章
          </Link>
        ) : null}
      </div>

      {error ? (
        <Card className="flex items-center justify-between gap-4 border-destructive/20 bg-destructive/5 p-5">
          <div>
            <p className="font-medium text-destructive">Dashboard 数据加载失败</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-9 items-center rounded-md border border-destructive/20 bg-background px-3 text-sm font-medium transition-all hover:border-destructive/30 hover:bg-muted"
          >
            重试
          </Link>
        </Card>
      ) : null}

      {stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="文章" value={stats.totalArticles} icon={FileText} gradient="bg-blue-500" />
            <StatCard label="用户" value={stats.totalUsers} icon={Users} gradient="bg-emerald-500" />
            <StatCard label="评论" value={stats.totalComments} icon={MessageSquare} gradient="bg-violet-500" />
            <StatCard label="留言" value={stats.totalGuestbook} icon={MessageSquareText} gradient="bg-amber-500" />
            <StatCard label="今日访问" value={stats.todayVisits} icon={Eye} gradient="bg-rose-500" />
          </div>

          <DashboardEcharts
            rangeDays={stats.rangeDays}
            visitTrend={stats.visitTrend}
            countryTimeline={stats.countryTimeline}
            searchEngineSources={stats.searchEngineSources}
          />

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">最近发布</h2>
                  <Link href="/admin/articles" className="text-xs text-muted-foreground hover:text-foreground">
                    查看全部
                  </Link>
                </div>
                {stats.recentArticles.length ? (
                  <div className="space-y-1.5">
                    {stats.recentArticles.map((article) => (
                      <div
                        key={article.id}
                        className="flex items-center justify-between rounded-lg p-2.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{article.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(article.publishedAt)}</p>
                        </div>
                        <Link
                          href={`/admin/articles/${article.id}/edit`}
                          className="ml-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="编辑文章"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">暂无已发布文章。</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 font-semibold">热门文章</h2>
                {stats.popularArticles.length ? (
                  <div className="space-y-2">
                    {stats.popularArticles.map((article, index) => (
                      <Link
                        key={article.slug}
                        href={`/articles/${article.slug}`}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{article.title}</p>
                          <p className="text-xs text-muted-foreground">{article.viewCount} 阅读</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">暂无文章数据。</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-dashed py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 font-medium">暂无 Dashboard 数据</p>
          <p className="mt-1 text-sm text-muted-foreground">
            数据库刚初始化完成，或者统计查询暂时没有返回结果。
          </p>
        </Card>
      )}
    </div>
  );
}
