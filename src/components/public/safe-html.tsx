import { sanitizeArticleHtml } from "@/lib/sanitize";
import { CodeCopyEnhancer } from "@/components/public/code-copy-enhancer";

export function SafeHtml({ html }: { html: string }) {
  return (
    <>
      <div
        className="prose-content"
        dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(html) }}
      />
      <CodeCopyEnhancer />
    </>
  );
}
