export const SEO_DESCRIPTION_MIN_LENGTH = 25;
export const SEO_DESCRIPTION_MAX_LENGTH = 160;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function charLength(value: string) {
  return Array.from(value).length;
}

function sliceChars(value: string, maxLength: number) {
  return Array.from(value).slice(0, maxLength).join("").trim();
}

export function stripHtmlForSeo(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
  );
}

export function isValidSeoDescription(value: string) {
  const normalized = normalizeWhitespace(value);
  const length = charLength(normalized);
  return length >= SEO_DESCRIPTION_MIN_LENGTH && length <= SEO_DESCRIPTION_MAX_LENGTH;
}

export function normalizeSeoDescription(value: string | null | undefined, fallback = "") {
  const normalized = normalizeWhitespace(value ?? "");
  const fallbackText = normalizeWhitespace(fallback);
  let candidate = normalized;

  if (charLength(candidate) < SEO_DESCRIPTION_MIN_LENGTH && charLength(fallbackText) > charLength(candidate)) {
    candidate = fallbackText;
  }

  if (charLength(candidate) > SEO_DESCRIPTION_MAX_LENGTH) {
    candidate = sliceChars(candidate, SEO_DESCRIPTION_MAX_LENGTH);
  }

  return candidate;
}

export function buildMetaDescription(
  value: string | null | undefined,
  fallback: string | null | undefined,
  locale: string | null | undefined = "zh-CN"
) {
  const defaultDescription = String(locale ?? "").toLowerCase().startsWith("en")
    ? "Read the latest articles, archives, tags, moments, and site updates."
    : "阅读本站最新文章、归档、标签、动态与联系方式等内容更新。";
  const firstPass = normalizeSeoDescription(value, fallback ?? "");
  return normalizeSeoDescription(firstPass, defaultDescription) || defaultDescription;
}
