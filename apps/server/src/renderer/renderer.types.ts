export const DEFAULT_RENDERER_VERSION = "markdown-renderer-v2";
export const DEFAULT_TEMPLATE_VERSION = "article-template-v2";
export const DEFAULT_CUSTOM_RULE_VERSION = "none";

export interface RendererVersions {
  rendererVersion: string;
  templateVersion: string;
  customRuleVersion: string;
}

export interface RenderHashInput extends RendererVersions {
  contentHash: string;
}

export interface MarkdownRenderInput {
  markdown: string;
  contentHash: string;
  allowedRoles?: string[];
  title?: string;
  description?: string | null;
  canonicalUrl?: string;
  alternates?: HreflangAlternate[];
  locale?: string;
  rendererVersion?: string;
  templateVersion?: string;
  customRuleVersion?: string;
}

export interface UsedAttachment {
  id: number;
  publicUrl: string;
}

export interface ArticleTocItem {
  id: string;
  level: 2 | 3 | 4;
  text: string;
}

export interface MarkdownRenderResult extends RendererVersions {
  bodyHtml: string;
  sanitizedBodyHtml: string;
  html: string;
  contentHash: string;
  renderHash: string;
  articleToc: ArticleTocItem[];
  usedAttachments: UsedAttachment[];
}

export interface TemplateRenderInput {
  bodyHtml: string;
  allowedRoles?: string[];
  title?: string;
  description?: string | null;
  canonicalUrl?: string;
  alternates?: HreflangAlternate[];
  articleToc?: ArticleTocItem[];
  locale?: string;
  templateVersion: string;
}

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}
