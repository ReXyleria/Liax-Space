import Link from "next/link";
import { notFound } from "next/navigation";
import { Hash, Tags } from "lucide-react";
import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { listPublicTags } from "@/features/articles/service";
import { localizedPath, urlLocaleToLocale } from "@/lib/locale-url";

export const dynamic = "force-dynamic";

function copy(locale: "zh-CN" | "en") {
  return locale === "en"
    ? {
        eyebrow: "Tag index",
        title: "Tags",
        description: "Browse article collections by topic. Each tag shows the number of published articles you can currently read.",
        count: "articles",
        emptyTitle: "No tags yet",
        emptyDescription: "Tags and article counts will appear here after published articles are tagged."
      }
    : {
        eyebrow: "标签索引",
        title: "标签",
        description: "按主题进入文章集合，每个标签显示当前可见的已发布文章数量。",
        count: "篇",
        emptyTitle: "暂无标签",
        emptyDescription: "发布文章并添加标签后，这里会显示标签名称和文章数量。"
      };
}

export default async function TagsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: urlLocale } = await params;
  const locale = urlLocaleToLocale(urlLocale);
  if (!locale) {
    notFound();
  }
  const text = copy(locale);
  const user = await getCurrentUser();
  const { tags, error } = await listPublicTags(user, locale);

  return (
    <PublicShell locale={locale}>
      <MotionPage>
        <main className="mx-auto max-w-6xl px-6 py-12">
          <section className="mb-10 overflow-hidden rounded-lg border border-white/70 bg-card/78 shadow-soft backdrop-blur-xl">
            <div className="p-6 md:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Tags className="h-3.5 w-3.5" />
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

          {tags.length ? (
            <MotionList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tags.map((tag) => (
                <MotionItem key={tag.id}>
                  <Link href={localizedPath(locale, `/articles?tag=${encodeURIComponent(tag.slug)}`)}>
                    <Card className="flex h-full items-center justify-between gap-4 p-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
                          style={tag.color ? { backgroundColor: `${tag.color}1f`, color: tag.color } : undefined}
                        >
                          <Hash className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-semibold">{tag.name}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">{tag.slug}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                        {tag.articleCount} {text.count}
                      </span>
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
