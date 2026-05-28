"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeCopyEnhancer } from "@/components/public/code-copy-enhancer";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import type { Locale } from "@/lib/i18n-messages";

type ArticleBlock = {
  blockIndex: number;
  html: string;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        loading: "Loading more...",
        failed: "Content loading failed."
      }
    : {
        loading: "正在加载更多...",
        failed: "正文加载失败。"
      };
}

export function ArticleContentBlocks({
  articleId,
  contentLocale,
  initialBlocks,
  blockCount,
  locale,
  endpointBase = "/api/articles"
}: {
  articleId: string;
  contentLocale: "zh-CN" | "en-US";
  initialBlocks: ArticleBlock[];
  blockCount: number;
  locale: Locale;
  endpointBase?: "/api/articles" | "/api/console/articles";
}) {
  const text = labels(locale);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const didPrefetchRef = useRef(false);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadedIndexes = useMemo(() => new Set(blocks.map((block) => block.blockIndex)), [blocks]);
  const lastBlockIndex = blocks.at(-1)?.blockIndex ?? -1;
  const hasMore = blocks.length < blockCount;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {
      return;
    }

    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `${endpointBase}/${articleId}/content-blocks?locale=${encodeURIComponent(contentLocale)}&after=${lastBlockIndex}&limit=2`,
        { cache: "no-store" }
      );
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || text.failed);
      }
      const nextBlocks = ((payload.blocks ?? []) as ArticleBlock[])
        .filter((block) => !loadedIndexes.has(block.blockIndex));
      if (nextBlocks.length) {
        setBlocks((current) => [...current, ...nextBlocks]);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [articleId, contentLocale, endpointBase, hasMore, lastBlockIndex, loadedIndexes, loading, text.failed]);

  useEffect(() => {
    if (!hasMore || didPrefetchRef.current) {
      return;
    }
    didPrefetchRef.current = true;
    const timer = window.setTimeout(() => {
      void loadMore();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [hasMore, loadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore();
      }
    }, { rootMargin: "900px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <>
      <div className="prose-content">
        {blocks.map((block) => (
          <section
            key={block.blockIndex}
            data-article-content-block={block.blockIndex}
            dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(block.html) }}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="min-h-6 py-2">
        {loading ? <p className="text-sm text-muted-foreground">{text.loading}</p> : null}
        {failed ? <p className="text-sm text-destructive">{text.failed}</p> : null}
      </div>
      <CodeCopyEnhancer />
    </>
  );
}
