import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { listPublishedArticles } from "@/features/articles/service";
import { articleHref, urlLocaleToLocale } from "@/lib/locale-url";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function copy(locale: "zh-CN" | "en") {
  return locale === "en"
    ? {
        eyebrow: "Reading index",
        title: "Articles",
        description: "Search titles, summaries, body text, and tags while keeping the reading entry simple.",
        activeTag: "Current tag:",
        search: "Search articles",
        emptyTitle: "No matching articles",
        emptyDescription: "Try another keyword or tag, or clear filters to view all articles."
      }
    : {
        eyebrow: "阅读索引",
        title: "文章",
        description: "搜索标题、摘要、正文和标签，保持阅读入口简单直接。",
        activeTag: "当前标签：",
        search: "搜索文章",
        emptyTitle: "没有找到相关文章",
        emptyDescription: "换一个关键词或标签，或者清空筛选后查看全部文章。"
      };
}

export default async function ArticlesPage({
  params: routeParams,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ q?: string; tag?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { locale: urlLocale } = await routeParams;
  const locale = urlLocaleToLocale(urlLocale);
  if (!locale) {
    notFound();
  }
  const text = copy(locale);

  const user = await getCurrentUser({ touchSession: false });
  const { articles, error } = await listPublishedArticles({ q: params.q, tag: params.tag, sort: "newest" }, user, locale);
  const activeTag = params.tag?.trim();

  return (
    <PublicShell locale={locale}>
      <MotionPage>
        <main className="mx-auto max-w-6xl px-6 py-12">
          <section className="mb-10 overflow-hidden rounded-lg border border-white/70 bg-card/78 shadow-soft backdrop-blur-xl">
            <div className="p-6 md:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {text.eyebrow}
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{text.title}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{text.description}</p>
              {activeTag ? (
                <p className="mt-4 inline-flex rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  {text.activeTag}{activeTag}
                </p>
              ) : null}
              <form className="mt-6 max-w-2xl">
                {activeTag ? <input type="hidden" name="tag" value={activeTag} /> : null}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    name="q"
                    placeholder={text.search}
                    defaultValue={params.q ?? ""}
                    className="h-12 w-full rounded-md border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </form>
            </div>
          </section>
          {error ? <p className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
          {articles.length ? (
            <MotionList className="grid gap-5 md:grid-cols-2">
              {articles.map((article) => (
                <MotionItem key={article.id}>
                  <Link href={articleHref(locale, article.slug)}>
                    <Card className="h-full overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-primary/40">
                      <div
                        className="h-48 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100"
                        style={
                          article.cover
                            ? {
                                backgroundImage: `linear-gradient(135deg, rgba(147,197,253,.2), rgba(216,180,254,.24)), url(${article.cover})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center"
                              }
                            : undefined
                        }
                      />
                      <div className="p-5">
                        <div className="mb-4 flex flex-wrap gap-2">
                          {article.tags.map((tag) => (
                            <span key={tag.slug} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                              {tag.name}
                            </span>
                          ))}
                        </div>
                        <h2 className="text-2xl font-semibold">{article.title}</h2>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{article.summary}</p>
                        <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
                          <span>{article.viewCount} {t(locale, "reads")}</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </MotionItem>
              ))}
            </MotionList>
          ) : (
            <Card className="p-10 text-center">
              <p className="text-lg font-medium">{text.emptyTitle}</p>
              <p className="mt-2 text-sm text-muted-foreground">{text.emptyDescription}</p>
            </Card>
          )}
        </main>
      </MotionPage>
    </PublicShell>
  );
}
