import { db, isDatabaseConfigured } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hashIp } from "@/lib/security";

const SEARCH_ENGINES = [
  { name: "Google", patterns: ["google."] },
  { name: "Bing", patterns: ["bing.com"] },
  { name: "Baidu", patterns: ["baidu.com"] },
  { name: "DuckDuckGo", patterns: ["duckduckgo.com"] },
  { name: "Yahoo", patterns: ["yahoo."] },
  { name: "Yandex", patterns: ["yandex."] },
  { name: "Sogou", patterns: ["sogou.com"] },
  { name: "360", patterns: ["so.com", "haosou.com"] },
  { name: "Shenma", patterns: ["sm.cn"] }
];

function normalizePath(value: unknown) {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path.slice(0, 500);
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function getCountryCode(request: Request) {
  const raw =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code") ||
    "";
  const code = raw.trim().toUpperCase();
  if (!code || code === "XX") {
    return "Unknown";
  }
  return code.slice(0, 16);
}

function getReferrerParts(value: unknown) {
  const referrer = typeof value === "string" ? value.trim() : "";
  if (!referrer) {
    return { referrer: null, referrerHost: null, searchEngine: "Direct" };
  }

  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const searchEngine = SEARCH_ENGINES.find((engine) =>
      engine.patterns.some((pattern) => host.includes(pattern))
    )?.name;

    return {
      referrer: referrer.slice(0, 2000),
      referrerHost: host.slice(0, 191),
      searchEngine: searchEngine ?? "Other"
    };
  } catch {
    // If the referrer isn't a valid URL, treat it as direct traffic
    // rather than polluting the "Other" category.
    return { referrer: referrer.slice(0, 2000), referrerHost: null, searchEngine: "Direct" };
  }
}

async function resolveArticleId(path: string) {
  const match = path.match(/^\/(?:zh-CN|en-US)\/articles\/([^/?#]+)/);
  const slug = match?.[1] ? decodeURIComponent(match[1]) : "";
  if (!slug) {
    return null;
  }

  const article = await db.article.findUnique({
    where: { slug },
    select: { id: true }
  });
  return article?.id ?? null;
}

export async function recordVisit(request: Request, input: unknown) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const body = typeof input === "object" && input ? input as Record<string, unknown> : {};
  const path = normalizePath(body.path);
  if (path.startsWith("/console") || path.startsWith("/api")) {
    return;
  }

  const referrerParts = getReferrerParts(body.referrer ?? request.headers.get("referer"));
  const [user, articleId] = await Promise.all([
    getCurrentUser().catch(() => null),
    resolveArticleId(path).catch(() => null)
  ]);

  await db.visitLog.create({
    data: {
      path,
      articleId,
      userId: user?.id ?? null,
      ipHash: hashIp(getClientIp(request)),
      userAgent: request.headers.get("user-agent")?.slice(0, 2000) ?? null,
      referrer: referrerParts.referrer,
      referrerHost: referrerParts.referrerHost,
      searchEngine: referrerParts.searchEngine,
      countryCode: getCountryCode(request)
    }
  });
}
