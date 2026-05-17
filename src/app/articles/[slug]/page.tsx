import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleStatus } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { getSiteConfig, resolveAbsoluteUrl } from "@/lib/site";
import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { ArticleToc, type TocItem } from "@/components/public/article-toc";
import { SafeHtml } from "@/components/public/safe-html";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { CommentForm } from "@/components/forms/comment-form";
import { getCurrentUser } from "@/lib/auth";
import { getPublishedArticleBySlug } from "@/features/articles/service";
import { resolveArticleDisplayTranslation } from "@/features/articles/translation-service";
import { listArticleComments } from "@/features/comments/service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [site, locale] = await Promise.all([getSiteConfig(), getCurrentLocale()]);

  if (!isDatabaseConfigured()) {
    return {
      title: site.title,
      description: site.subtitle
    };
  }

  const article = await db.article.findFirst({
    where: {
      slug,
      status: ArticleStatus.PUBLISHED,
      deletedAt: null
    },
    select: {
      title: true,
      summary: true,
      contentHtml: true,
      translations: true,
      cover: true
    }
  });

  if (!article) {
    return {
      title: site.title,
      description: site.subtitle
    };
  }

  const display = resolveArticleDisplayTranslation(article, locale);
  const title = display.title;
  const summary = display.summary;
  const url = resolveAbsoluteUrl(site.url, `/articles/${slug}`);

  return {
    title: `${title} - ${site.title}`,
    description: summary || site.subtitle,
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description: summary || site.subtitle,
      url,
      siteName: site.title,
      images: article.cover ? [{ url: article.cover }] : undefined
    }
  };
}

function plainTextFromHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function slugifyHeading(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function prepareArticleHtml(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const seen = new Map<string, number>();

  const nextHtml = html.replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, levelValue, attrs, content) => {
    const level = Number(levelValue) as 1 | 2 | 3 | 4;
    const title = plainTextFromHtml(content);

    if (!title) {
      return match;
    }

    const baseId = slugifyHeading(title, `heading-${toc.length + 1}`);
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    const id = count ? `${baseId}-${count + 1}` : baseId;
    toc.push({ id, title, level });

    const cleanedAttrs = String(attrs).replace(/\s+id=(["']).*?\1/i, "");
    return `<h${level}${cleanedAttrs} id="${id}">${content}</h${level}>`;
  });

  return { html: nextHtml, toc };
}

export default async function ArticleDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, locale] = await Promise.all([getCurrentUser(), getCurrentLocale()]);
  const { article, canView, error } = await getPublishedArticleBySlug(slug, user, locale);

  if (error) {
    return (
      <PublicShell>
        <main className="mx-auto max-w-3xl px-6 py-16">
          <Card className="p-8 text-destructive">{error}</Card>
        </main>
      </PublicShell>
    );
  }

  if (!article) {
    notFound();
  }

  if (!canView) {
    return (
      <PublicShell>
        <main className="mx-auto max-w-3xl px-6 py-16">
          <Card className="p-8">
            <h1 className="text-2xl font-semibold">{t(locale, "accessDenied")}</h1>
            <p className="mt-3 text-muted-foreground">{t(locale, "articleRequiresHigherRole")}</p>
            <Link className="mt-5 inline-flex text-primary" href="/login">
              {t(locale, "loginAndRetry")}
            </Link>
          </Card>
        </main>
      </PublicShell>
    );
  }

  const comments = await listArticleComments(article.id);
  const prepared = prepareArticleHtml(article.contentHtml);

  return (
    <PublicShell>
      <MotionPage>
        <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">
            <article>
              <MotionItem className="mb-8">
                {article.cover ? (
                  <div
                    className="mb-8 h-[320px] rounded-lg border border-white/70 bg-gradient-to-br from-blue-100 to-purple-100 shadow-soft"
                    style={{
                      backgroundImage: `linear-gradient(135deg, rgba(147,197,253,.18), rgba(216,180,254,.24)), url(${article.cover})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  />
                ) : null}
                <div className="mb-4 flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span key={tag.slug} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {tag.name}
                    </span>
                  ))}
                </div>
                <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{article.title}</h1>
                {article.summary ? <p className="mt-4 text-muted-foreground">{article.summary}</p> : null}
                {article.translationStatus === "fallback" ? (
                  <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {article.translationError || t(locale, "articleTranslationFallback")}
                  </p>
                ) : null}
                <p className="mt-5 text-sm text-muted-foreground">
                  {article.author.nickname} · {formatDate(article.publishedAt ?? article.createdAt)} · {article.viewCount + 1} {t(locale, "reads")}
                </p>
              </MotionItem>
              <MotionItem>
                <Card className="p-6 md:p-8">
                  <SafeHtml html={prepared.html} />
                </Card>
              </MotionItem>
            </article>
            <section className="mt-12 border-t pt-8">
              <h2 className="text-2xl font-semibold">{t(locale, "comments")}</h2>
              <MotionList className="mt-5 space-y-4">
                {comments.length ? (
                  comments.map((comment) => (
                    <MotionItem key={comment.id}>
                      <Card className="p-4">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <UserAvatar
                            src={comment.user.avatar}
                            name={comment.user.nickname}
                            className="h-6 w-6 text-xs"
                          />
                          <p className="text-sm font-medium">{comment.user.nickname}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{comment.content}</p>
                        <p className="mt-1.5 text-[0.7rem] text-muted-foreground/60">{comment.deviceName || t(locale, "unknownDevice")}</p>
                      </Card>
                    </MotionItem>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t(locale, "noComments")}</p>
                )}
              </MotionList>
              <div className="mt-6">
                {user ? (
                  <CommentForm articleId={article.id} />
                ) : (
                  <Card className="p-5 text-sm text-muted-foreground">
                    {t(locale, "loginToComment")} <Link className="text-primary" href="/login">{t(locale, "goToLogin")}</Link>
                  </Card>
                )}
              </div>
            </section>
          </div>
          <ArticleToc items={prepared.toc} />
        </main>
      </MotionPage>
    </PublicShell>
  );
}
