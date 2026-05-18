import Link from "next/link";
import { AdminArticleTable } from "@/components/admin/admin-article-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageArticles } from "@/lib/permissions";
import { getAllTags, listAdminArticles } from "@/features/articles/service";
import { getDefaultTranslationTargetLocale } from "@/features/articles/translation-jobs";

function labels(locale: Awaited<ReturnType<typeof getAdminLocale>>) {
  return locale === "en"
    ? {
        title: "Article management",
        description: "Create, edit, publish, translate, and manage article visibility.",
        newArticle: "New article",
        loadingFailed: "Failed to load articles",
        reload: "Reload",
        empty: "No articles yet. Create the first one.",
        createFirst: "Create the first article"
      }
    : {
        title: "文章管理",
        description: "创建、编辑、发布、翻译和管理文章可见性。",
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
  const [{ articles, error }, tagOptions, defaultTargetLocale] = await Promise.all([
    listAdminArticles(user),
    getAllTags(),
    getDefaultTranslationTargetLocale()
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
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
      {articles.length ? (
        <AdminArticleTable
          articles={articles}
          tagOptions={tagOptions}
          locale={locale}
          defaultTargetLocale={defaultTargetLocale}
        />
      ) : (
        <Card className="space-y-4 p-8 text-center">
          <p className="text-sm text-muted-foreground">{text.empty}</p>
          <Link href="/admin/articles/new" className="inline-flex text-sm font-medium text-primary hover:underline">
            {text.createFirst}
          </Link>
        </Card>
      )}
    </div>
  );
}
