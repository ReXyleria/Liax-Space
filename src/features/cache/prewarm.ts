import { ArticleStatus } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import { getSiteConfig, resolveAbsoluteUrl } from "@/lib/site";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";

const basePublicPaths = [
  "/",
  "/articles",
  "/tags",
  "/archives",
  "/moments",
  "/guestbook",
  "/contact"
];

export type CachePrewarmResult = {
  total: number;
  success: number;
  failed: Array<{ path: string; locale?: string; status?: number; error?: string }>;
  durationMs: number;
  baseUrl: string;
};

type PrewarmOptions = {
  concurrency?: number;
  baseUrl?: string;
};

function normalizeBaseUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolvePrewarmBaseUrl(siteUrl: string, baseUrl?: string) {
  const configured =
    normalizeBaseUrl(baseUrl) ||
    normalizeBaseUrl(process.env.CACHE_PREWARM_BASE_URL) ||
    normalizeBaseUrl(process.env.APP_INTERNAL_URL);

  if (configured) {
    return configured;
  }

  const port = process.env.PORT || "3000";
  if (process.env.NODE_ENV === "production" || process.env.NEXT_RUNTIME === "nodejs") {
    return `http://127.0.0.1:${port}`;
  }

  return siteUrl;
}

export async function getPublicPrewarmPaths(limit = 50) {
  const paths = new Set(basePublicPaths);

  if (!isDatabaseConfigured()) {
    return Array.from(paths);
  }

  const [articles, tags] = await Promise.all([
    db.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        deletedAt: null,
        publishedAt: { not: null }
      },
      select: { slug: true },
      orderBy: { publishedAt: "desc" },
      take: limit
    }),
    db.tag.findMany({
      select: { slug: true },
      orderBy: { name: "asc" },
      take: limit
    })
  ]);

  for (const article of articles) {
    paths.add(`/articles/${article.slug}`);
  }

  for (const tag of tags) {
    paths.add(`/articles?tag=${encodeURIComponent(tag.slug)}`);
  }

  return Array.from(paths);
}

async function runWithConcurrency<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await task(item);
    }
  });
  await Promise.all(workers);
}

export async function prewarmPublicCache(limit = 50, options: PrewarmOptions = {}): Promise<CachePrewarmResult> {
  const startedAt = Date.now();
  const site = await getSiteConfig();
  const baseUrl = resolvePrewarmBaseUrl(site.url, options.baseUrl);
  const paths = await getPublicPrewarmPaths(limit);
  const locales = ["zh-CN", "en"] as const;
  const requests = locales.flatMap((locale) => paths.map((path) => ({ path, locale })));
  const failed: CachePrewarmResult["failed"] = [];
  const concurrency = Math.min(8, Math.max(1, options.concurrency ?? Number(process.env.CACHE_PREWARM_CONCURRENCY ?? 4)));

  await runWithConcurrency(requests, concurrency, async ({ path, locale }) => {
    try {
      const response = await fetch(resolveAbsoluteUrl(baseUrl, path), {
        method: "GET",
        headers: {
          "User-Agent": "liax_space-cache-prewarm/1.0",
          "X-Cache-Prewarm": "1",
          "Accept-Language": locale,
          "Cookie": `${LOCALE_COOKIE_NAME}=${locale}`
        }
      });

      if (!response.ok) {
        failed.push({ path, locale, status: response.status });
      }
    } catch (error) {
      failed.push({
        path,
        locale,
        error: error instanceof Error ? error.message : "Request failed."
      });
    }
  });

  return {
    total: requests.length,
    success: requests.length - failed.length,
    failed,
    durationMs: Date.now() - startedAt,
    baseUrl
  };
}
