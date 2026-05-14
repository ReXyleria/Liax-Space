"use client";

import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import { ArticleToc, type TocItem } from "@/components/public/article-toc";
import { CodeCopyEnhancer } from "@/components/public/code-copy-enhancer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BlockEditorLocale } from "@/components/editor/block-editor/editor-types";

export type ArticlePreviewDraft = {
  title: string;
  slug: string;
  summary: string;
  cover: string;
  contentHtml: string;
  contentJson: string;
  status: string;
  visibility: string;
  tagNames: string;
  seoTitle: string;
  seoDescription: string;
  allowComments: boolean;
  pinned: boolean;
  featured: boolean;
  savedAt: number;
};

export type PreviewSiteSettings = {
  title: string;
  subtitle: string;
  logo: string;
  copyright: string;
  icp: string;
  icpUrl: string;
  police: string;
  policeUrl: string;
};

type PreviewMode = "phone" | "tablet" | "desktop";

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

    const baseId = slugifyHeading(title, `preview-heading-${toc.length + 1}`);
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    const id = count ? `${baseId}-${count + 1}` : baseId;
    toc.push({ id, title, level });

    const cleanedAttrs = String(attrs).replace(/\s+id=(["']).*?\1/i, "");
    return `<h${level}${cleanedAttrs} id="${id}">${content}</h${level}>`;
  });

  return { html: nextHtml, toc };
}

function previewWidthClass(mode: PreviewMode) {
  if (mode === "phone") {
    return "w-[390px] max-w-full";
  }

  if (mode === "tablet") {
    return "w-[820px] max-w-full";
  }

  return "w-[1180px] max-w-full";
}

function labels(locale: BlockEditorLocale) {
  return locale === "en"
    ? {
        close: "Close",
        phone: "Phone",
        tablet: "Tablet",
        desktop: "Desktop",
        hint: "Preview does not publish or save this draft.",
        nav: ["Home", "Articles", "Tags", "Moments", "Archives"],
        summaryFallback: "No summary yet.",
        byline: "Draft preview"
      }
    : {
        close: "关闭",
        phone: "手机",
        tablet: "平板",
        desktop: "桌面",
        hint: "预览不会发布或保存当前草稿。",
        nav: ["首页", "文章", "标签", "瞬间", "归档"],
        summaryFallback: "暂无摘要。",
        byline: "草稿预览"
      };
}

export function ArticlePreviewOverlay({
  open,
  draft,
  mode,
  locale = "zh-CN",
  site,
  onModeChange,
  onClose
}: {
  open: boolean;
  draft: ArticlePreviewDraft | null;
  mode: PreviewMode;
  locale?: BlockEditorLocale;
  site: PreviewSiteSettings;
  onModeChange: (mode: PreviewMode) => void;
  onClose: () => void;
}) {
  if (!open || !draft) {
    return null;
  }

  const text = labels(locale);
  const prepared = prepareArticleHtml(draft.contentHtml);
  const tags = draft.tagNames.split(",").map((tag) => tag.trim()).filter(Boolean);
  const copyright = site.copyright || `© ${new Date().getFullYear()} ${site.title}`;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background/98 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 shadow-sm">
        <p className="text-sm text-muted-foreground">{text.hint}</p>
        <div className="flex items-center gap-2">
          {([
            ["phone", Smartphone, text.phone],
            ["tablet", Tablet, text.tablet],
            ["desktop", Monitor, text.desktop]
          ] as const).map(([nextMode, Icon, label]) => (
            <Button
              key={nextMode}
              type="button"
              variant={mode === nextMode ? "primary" : "secondary"}
              className="h-9 px-3"
              onClick={() => onModeChange(nextMode)}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
          <Button type="button" variant="ghost" className="h-9 px-3" onClick={onClose} title={text.close}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/35 p-4">
        <div className={`mx-auto min-h-full overflow-hidden rounded-xl border bg-background shadow-soft ${previewWidthClass(mode)}`}>
          <header className="sticky top-0 z-10 border-b bg-background/86 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                {site.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview renders already-configured site logo without changing image config.
                  <img src={site.logo} alt="" className="h-8 w-8 rounded-md object-cover" />
                ) : null}
                <span className="truncate text-sm font-semibold">{site.title}</span>
              </div>
              <nav className="hidden gap-4 text-sm text-muted-foreground md:flex">
                {text.nav.map((item) => <span key={item}>{item}</span>)}
              </nav>
            </div>
          </header>
          <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="min-w-0">
              <article>
                {draft.cover ? (
                  <div
                    className="mb-8 h-[320px] rounded-lg border border-white/70 bg-gradient-to-br from-blue-100 to-purple-100 shadow-soft"
                    style={{
                      backgroundImage: `linear-gradient(135deg, rgba(147,197,253,.18), rgba(216,180,254,.24)), url(${draft.cover})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  />
                ) : null}
                <div className="mb-4 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{draft.title || site.title}</h1>
                <p className="mt-4 text-muted-foreground">{draft.summary || text.summaryFallback}</p>
                <p className="mt-5 text-sm text-muted-foreground">{text.byline}</p>
                <Card className="mt-8 p-6 md:p-8">
                  <div className="prose-content" dangerouslySetInnerHTML={{ __html: prepared.html }} />
                  <CodeCopyEnhancer />
                </Card>
              </article>
            </div>
            <ArticleToc items={prepared.toc} />
          </main>
          <footer className="border-t bg-background px-5 py-5 text-xs text-muted-foreground">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <span>{copyright}</span>
              {site.icp ? (
                <a href={site.icpUrl || "https://beian.miit.gov.cn/"} target="_blank" rel="noreferrer">
                  {site.icp}
                </a>
              ) : null}
              {site.police ? (
                <a href={site.policeUrl || "https://www.beian.gov.cn/portal/registerSystemInfo"} target="_blank" rel="noreferrer">
                  {site.police}
                </a>
              ) : null}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
