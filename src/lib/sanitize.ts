const DISALLOWED_BLOCK_TAGS = ["script", "style", "iframe", "object", "embed", "meta", "link", "base"];
const DISALLOWED_INLINE_TAGS = ["form", "input", "button", "textarea", "select", "option"];
const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "p", "strong", "em", "s", "blockquote", "code", "pre", "ul", "ol", "li",
  "mark", "span", "table", "colgroup", "col", "tbody", "thead", "tr", "td", "th", "details", "summary",
  "div", "a", "img", "hr", "br"
]);

function stripDangerousBlocks(html: string) {
  let next = html;
  for (const tag of [...DISALLOWED_BLOCK_TAGS, ...DISALLOWED_INLINE_TAGS]) {
    const pattern = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
    next = next.replace(pattern, "");
  }
  return next;
}

function sanitizeAttributes(rawAttrs: string, tagName: string) {
  const attrMatches = rawAttrs.match(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(".*?"|'.*?'|[^\s"'>]+)/g) ?? [];
  const normalized: string[] = [];

  for (const item of attrMatches) {
    const sep = item.indexOf("=");
    if (sep <= 0) continue;
    const key = item.slice(0, sep).trim().toLowerCase();
    let value = item.slice(sep + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");

    if (key.startsWith("on")) continue;
    if (key === "srcdoc") continue;
    if (key === "href" || key === "src") {
      if (!/^(https?:|mailto:|\/)/i.test(value)) continue;
      if (/^javascript:/i.test(value)) continue;
    }
    if (key === "style" && /expression\s*\(|url\s*\(\s*javascript:/i.test(value)) continue;

    if (tagName === "a" && (key === "target" || key === "rel")) {
      continue;
    }

    normalized.push(`${key}="${value.replace(/"/g, "&quot;")}"`);
  }

  if (tagName === "a") {
    normalized.push('target="_blank"');
    normalized.push('rel="noopener noreferrer"');
  }

  return normalized.length ? ` ${normalized.join(" ")}` : "";
}

export function sanitizeArticleHtml(html: string) {
  let safe = stripDangerousBlocks(html);
  safe = safe.replace(/<\s*\/?\s*([a-zA-Z0-9:-]+)([^>]*)>/g, (full, name, attrs) => {
    const tagName = String(name).toLowerCase();
    const closing = /^<\s*\//.test(full);
    if (!ALLOWED_TAGS.has(tagName)) {
      return "";
    }

    if (closing) {
      return `</${tagName}>`;
    }

    const sanitizedAttrs = sanitizeAttributes(String(attrs ?? ""), tagName);
    const selfClose = /\/\s*>$/.test(full) || tagName === "img" || tagName === "br" || tagName === "hr" || tagName === "col";
    return selfClose ? `<${tagName}${sanitizedAttrs} />` : `<${tagName}${sanitizedAttrs}>`;
  });

  return safe;
}
