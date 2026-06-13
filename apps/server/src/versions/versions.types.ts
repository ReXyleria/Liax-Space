export type MarkdownContent = string;
export type NormalizedMarkdown = string;
export type Sha256Hex = string;
export type ContentHash = Sha256Hex;
export type RenderHash = Sha256Hex;

export type ArticleVersionLocale = "zh-CN" | "en-US";
export type RenderStatus = string;

export type ArticleVersion = {
  id: number;
  articleId: number;
  locale: ArticleVersionLocale;
  versionNo: number;
  mdContent: MarkdownContent;
  contentHash: ContentHash;
  renderHash: RenderHash | null;
  htmlPath: string | null;
  renderStatus: RenderStatus;
  rendererVersion: string | null;
  templateVersion: string | null;
  customRuleVersion: string | null;
  createdBy: number;
  createdAt: Date;
  isPublishedSnapshot: boolean;
  isPinned: boolean;
};

export type ArticleVersionSummary = Omit<ArticleVersion, "mdContent"> & {
  contentSizeBytes: number;
};

export type CreateArticleVersionInput = {
  articleId: number;
  locale: ArticleVersionLocale;
  versionNo: number;
  mdContent: MarkdownContent;
  contentHash: ContentHash;
  renderHash?: RenderHash | null;
  htmlPath?: string | null;
  renderStatus?: RenderStatus;
  rendererVersion?: string | null;
  templateVersion?: string | null;
  customRuleVersion?: string | null;
  createdBy: number;
};

export type UpdateRenderStatusInput = {
  versionId: number;
  renderStatus: RenderStatus;
  renderHash?: RenderHash | null;
};

export type UpdateHtmlPathInput = {
  versionId: number;
  htmlPath: string | null;
};

export type UpdatePublishedRenderResultInput = {
  versionId: number;
  renderHash: RenderHash;
  htmlPath: string;
  rendererVersion: string;
  templateVersion: string;
  customRuleVersion: string;
};

export type ReplaceVersionAttachmentsInput = {
  versionId: number;
  attachmentIds: number[];
};

export type FindVersionsForCleanupInput = {
  articleId: number;
  locale: ArticleVersionLocale;
  keepLatest: number;
  limit?: number;
};
