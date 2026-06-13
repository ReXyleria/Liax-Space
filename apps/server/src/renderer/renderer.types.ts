export const DEFAULT_RENDERER_VERSION = "markdown-renderer-v1";
export const DEFAULT_TEMPLATE_VERSION = "article-template-v1";
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

export interface MarkdownRenderResult extends RendererVersions {
  bodyHtml: string;
  sanitizedBodyHtml: string;
  html: string;
  contentHash: string;
  renderHash: string;
  usedAttachments: UsedAttachment[];
}

export interface TemplateRenderInput {
  bodyHtml: string;
  title?: string;
  description?: string | null;
  canonicalUrl?: string;
  alternates?: HreflangAlternate[];
  locale?: string;
  templateVersion: string;
}

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}
