import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminAccess } from "@/lib/admin-guard";
import { canManageArticles, canViewAnalytics } from "@/lib/permissions";
import { getDashboardStats } from "@/features/analytics/service";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await requireAdminAccess("/admin");

  if (!canViewAnalytics(user)) {
    redirect(canManageArticles(user) ? "/admin/articles" : "/admin/account?section=profile");
  }

  const { stats, error } = await getDashboardStats(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">数据库统计闭环，查询失败时显示错误状态。</p>
      </div>
      {error ? (
        <Card className="flex items-center justify-between gap-4 border-destructive/20 bg-destructive/5 p-5">
          <div>
            <p className="font-medium text-destructive">Dashboard 数据加载失败</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center justify-center rounded-md border border-destructive/20 bg-background px-4 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-destructive/30 hover:bg-muted"
          >
            重新加载
          </Link>
        </Card>
      ) : null}
      {stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            {[
              ["文章", stats.totalArticles],
              ["用户", stats.totalUsers],
              ["评论", stats.totalComments],
              ["留言", stats.totalGuestbook],
              ["今日访问", stats.todayVisits]
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>热门文章</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.popularArticles.length ? (
                <div className="space-y-3">
                  {stats.popularArticles.map((article) => (
                    <div key={article.slug} className="flex items-center justify-between rounded-md border p-3">
                      <span>{article.title}</span>
                      <span className="text-sm text-muted-foreground">{article.viewCount} 阅读</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无文章数据。</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed p-8 text-muted-foreground">
          <p className="font-medium text-foreground">暂无 Dashboard 数据。</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            这通常表示数据库刚初始化完成，或者统计查询暂时没有返回结果。刷新页面后如果仍然为空，请检查数据库连接和访问权限。
          </p>
        </Card>
      )}
    </div>
  );
}
