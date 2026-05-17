import Link from "next/link";
import { ArticleActionsMenu } from "@/components/admin/article-actions-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdminPermission } from "@/lib/admin-guard";
import { articleStatusLabel } from "@/lib/article-status";
import { contentVisibilityBadgeClass, contentVisibilityLabel } from "@/lib/content-visibility";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageArticles } from "@/lib/permissions";
import { listAdminArticles, getAllTags } from "@/features/articles/service";
import { formatDate } from "@/lib/utils";

function labels(locale: Awaited<ReturnType<typeof getAdminLocale>>) {
  return locale === "en"
    ? {
        title: "Article management",
        description: "Create, edit, publish, and manage article visibility.",
        newArticle: "New article",
        loadingFailed: "Failed to load articles",
        reload: "Reload",
        empty: "No articles yet. Create the first one.",
        createFirst: "Create the first article"
      }
    : {
        title: "文章管理",
        description: "创建、编辑、发布和管理文章可见性。",
        newArticle: "新建文章",
        loadingFailed: "文章列表加载失败",
        reload: "重新加载",
        empty: "暂无文章，先创建第一篇。",
        createFirst: "立即新建文章"
      };
}

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageArticles, "/admin/articles")
  ]);
  const text = labels(locale);
  const [{ articles, error }, tagOptions] = await Promise.all([
    listAdminArticles(user),
    getAllTags()
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{text.title}</h1>
          <p className="mt-2 text-muted-foreground">{text.description}</p>
        </div>
        <Link href="/admin/articles/new">
          <Button>{text.newArticle}</Button>
        </Link>
      </div>
      {error ? (
        <Card className="flex items-center justify-between gap-4 border-destructive/20 bg-destructive/5 p-5">
          <div>
            <p className="font-medium text-destructive">{text.loadingFailed}</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
          <Link
            href="/admin/articles"
            className="inline-flex h-10 items-center justify-center rounded-md border border-destructive/20 bg-background px-4 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-destructive/30 hover:bg-muted"
          >
            {text.reload}
          </Link>
        </Card>
      ) : null}
      <Card className="overflow-visible">
        {articles.length ? (
          <div className="divide-y">
            {articles.map((article) => (
              <div
                key={article.id}
                className="grid gap-3 p-5 transition hover:bg-muted/60 md:grid-cols-[1fr_120px_140px_140px_64px] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/articles/${article.id}/edit`} className="font-medium hover:text-primary">
                      {article.title}
                    </Link>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        article.translationReady ? "bg-emerald-500" : "bg-red-500"
                      }`}
                      title={
                        article.translationReady
                          ? `已翻译：${article.translationTargetLocale}`
                          : `未完成翻译：${article.translationTargetLocale}`
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {article.translationReady ? "已翻译" : "未翻译"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{article.slug}</p>
                </div>
                <span className="text-sm text-muted-foreground">{articleStatusLabel(locale, article.status)}</span>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${contentVisibilityBadgeClass(article.visibility)}`}
                >
                  {contentVisibilityLabel(locale, article.visibility)}
                </span>
                <span className="text-sm text-muted-foreground">{formatDate(article.publishedAt ?? article.createdAt)}</span>
                <ArticleActionsMenu article={article} tagOptions={tagOptions} locale={locale} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">{text.empty}</p>
            <Link href="/admin/articles/new" className="inline-flex text-sm font-medium text-primary hover:underline">
              {text.createFirst}
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
