import { ArticleStatus, ContentVisibility } from "@prisma/client";
import { z } from "zod";
import { SEO_DESCRIPTION_MAX_LENGTH, SEO_DESCRIPTION_MIN_LENGTH } from "@/lib/seo";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const articleLocaleSchema = z.enum(["zh-CN", "en-US"]).default("zh-CN");
const seoDescriptionSchema = z.string()
  .trim()
  .max(SEO_DESCRIPTION_MAX_LENGTH, `SEO description cannot exceed ${SEO_DESCRIPTION_MAX_LENGTH} characters.`)
  .refine(
    (value) => !value || Array.from(value).length >= SEO_DESCRIPTION_MIN_LENGTH,
    `SEO description must be at least ${SEO_DESCRIPTION_MIN_LENGTH} characters.`
  )
  .optional()
  .default("");

export const articleMutationSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(120, "Title cannot exceed 120 characters."),
  slug: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => typeof value === "string" ? value.trim() : "")
    .refine(
      (value) => value === "" || (value.length <= 140 && slugPattern.test(value)),
      "Slug may only contain lowercase letters, numbers, and hyphens."
    ),
  summary: z.string().max(600, "Summary cannot exceed 600 characters.").optional().default(""),
  cover: z.string().max(500, "Cover URL cannot exceed 500 characters.").optional().default(""),
  contentJson: z.unknown(),
  contentHtml: z.string().min(1, "Article content cannot be empty."),
  status: z.nativeEnum(ArticleStatus).default(ArticleStatus.DRAFT),
  visibility: z.nativeEnum(ContentVisibility).default(ContentVisibility.PUBLIC),
  allowComments: z.boolean().default(true),
  pinned: z.boolean().default(false),
  featured: z.boolean().default(false),
  seoTitle: z.string().max(120, "SEO title cannot exceed 120 characters.").optional().default(""),
  seoDescription: seoDescriptionSchema,
  sourceLocale: articleLocaleSchema,
  tagNames: z.array(z.string().trim().min(1).max(30, "Tag cannot exceed 30 characters.")).max(12, "At most 12 tags are allowed.").default([]),
  publishedAt: z.preprocess(
    (value) => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "string" && value.trim() === "") return null;
      return value;
    },
    z.string().datetime({ offset: true }).nullable()
  ).transform((value) => value ? new Date(value) : null).optional().nullable()
});

export const articleMetaSchema = z.object({
  slug: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => typeof value === "string" ? value.trim() : "")
    .refine(
      (value) => value === "" || (value.length <= 140 && slugPattern.test(value)),
      "Slug may only contain lowercase letters, numbers, and hyphens."
    ),
  summary: z.string().max(600, "Summary cannot exceed 600 characters.").optional().default(""),
  cover: z.string().max(500, "Cover URL cannot exceed 500 characters.").optional().default(""),
  visibility: z.nativeEnum(ContentVisibility).default(ContentVisibility.PUBLIC),
  allowComments: z.boolean().default(true),
  pinned: z.boolean().default(false),
  featured: z.boolean().default(false),
  seoTitle: z.string().max(120, "SEO title cannot exceed 120 characters.").optional().default(""),
  seoDescription: seoDescriptionSchema,
  tagNames: z.array(z.string().trim().min(1).max(30, "Tag cannot exceed 30 characters.")).max(12, "At most 12 tags are allowed.").default([]),
  publishedAt: z.preprocess(
    (value) => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "string" && value.trim() === "") return null;
      return value;
    },
    z.string().datetime({ offset: true }).nullable()
  ).transform((value) => value ? new Date(value) : null).optional().nullable()
});

export const articleQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(["newest", "popular"]).optional().default("newest")
});
