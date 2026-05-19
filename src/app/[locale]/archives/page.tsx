import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, CalendarDays } from "lucide-react";
import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { listPublishedArticleArchives } from "@/features/articles/service";
import { articleHref, urlLocaleToLocale } from "@/lib/locale-url";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function copy(locale: "zh-CN" | "en", articleCount: number) {
  return locale === "en"
    ? {
        eyebrow: "Archive",
        title: "Archives",
        description: `Published articles are grouped by year and month. ${articleCount} visible articles are available now.`,
        count: "articles",
        emptyTitle: "No archives yet",
        emptyDescription: "After articles are published, archives will be grouped by year and month automatically."
      }
    : {
        eyebrow: "归档",
        title: "归档",
        description: `按年份和月份整理已发布文章，目前共 ${articleCount} 篇可见文章。`,
        count: "篇文章",
        emptyTitle: "暂无归档",
        emptyDescription: "发布文章后，归档会自动按年月聚合展示。"
      };
}

export default async function ArchivesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: urlLocale } = await params;
  const locale = urlLocaleToLocale(urlLocale);
  if (!locale) {
    notFound();
  }

  const user = await getCurrentUser();
  const { archives, error } = await listPublishedArticleArchives(user, locale);
  const articleCount = archives.reduce((total, group) => total + group.articles.length, 0);
  const text = copy(locale, articleCount);

  return (
    <PublicShell locale={locale}>
      <MotionPage>
        <main className="mx-auto max-w-6xl px-6 py-12">
          <section className="mb-10 overflow-hidden rounded-lg border border-white/70 bg-card/78 shadow-soft backdrop-blur-xl">
            <div className="p-6 md:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Archive className="h-3.5 w-3.5" />
                {text.eyebrow}
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-normal md:text-5xl">{text.title}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{text.description}</p>
            </div>
          </section>

          {error ? (
            <p className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {archives.length ? (
            <MotionList className="space-y-5">
              {archives.map((group) => (
                <MotionItem key={group.key}>
                  <Card className="overflow-hidden p-0">
                    <div className="flex items-center justify-between border-b bg-muted/35 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                          <CalendarDays className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="text-xl font-semibold">{group.label}</h2>
                          <p className="text-sm text-muted-foreground">{group.articles.length} {text.count}</p>
                        </div>
                      </div>
                    </div>
                    <div className="divide-y divide-white/70">
                      {group.articles.map((article) => (
                        <Link
                          key={article.id}
                          className="flex flex-col gap-2 px-5 py-4 transition hover:bg-muted/35 md:flex-row md:items-center md:justify-between"
                          href={articleHref(locale, article.slug)}
                        >
                          <span className="font-medium">{article.title}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(article.publishedAt ?? article.createdAt)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </Card>
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
