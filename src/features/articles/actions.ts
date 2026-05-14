"use server";

import { ArticleStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { getAdminLocale, type Locale } from "@/lib/i18n";
import {
  createArticle,
  deleteArticle,
  restoreArticleVersion,
  setArticleStatus,
  updateArticle
} from "@/features/articles/service";
import { articleMutationSchema } from "@/features/articles/validators";

export type ArticleActionState = {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string[]>;
  redirectTo?: string;
};

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function parseEditorJson(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? "{}"));
  } catch {
    return { type: "doc", content: [] };
  }
}

function parseArticleForm(formData: FormData) {
  const tagNames = formData
    .getAll("tagNames")
    .flatMap((tag) => String(tag).split(","))
    .map((tag) => tag.trim())
    .filter(Boolean);
  const allowedIdentityIds = formData
    .getAll("allowedIdentityIds")
    .flatMap((identityId) => String(identityId).split(","))
    .map((identityId) => identityId.trim())
    .filter(Boolean);

  return {
    title: formData.get("title"),
    slug: formData.get("slug"),
    summary: formData.get("summary") ?? "",
    cover: formData.get("cover") ?? "",
    contentJson: parseEditorJson(formData.get("contentJson")),
    contentHtml: formData.get("contentHtml") ?? "",
    status: formData.get("status") ?? "DRAFT",
    visibility: formData.get("visibility") ?? "PUBLIC",
    allowComments: parseBoolean(formData.get("allowComments")),
    pinned: parseBoolean(formData.get("pinned")),
    featured: parseBoolean(formData.get("featured")),
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
    tagNames,
    allowedIdentityIds
  };
}

function fieldErrorsFromZod(error: ZodError) {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).filter(([, messages]) => messages && messages.length > 0)
  ) as Record<string, string[]>;
}

function actionText(locale: Locale) {
  return locale === "en"
    ? {
        checkFields: "Please check the highlighted fields.",
        articleLinkUsed: "The article link is already used.",
        articleLinkUsedField: "This article link is already used. Use another link or leave it blank.",
        saveFailed: "Article save failed. Please try again later.",
        articleSaved: "Article saved."
      }
    : {
        checkFields: "请检查高亮字段。",
        articleLinkUsed: "文章链接已被使用。",
        articleLinkUsedField: "这个文章链接已被使用，请换一个链接或留空。",
        saveFailed: "文章保存失败，请稍后再试。",
        articleSaved: "文章已保存。"
      };
}

function actionErrorState(error: unknown, locale: Locale): ArticleActionState {
  const text = actionText(locale);
  if (error instanceof ZodError) {
    return {
      ok: false,
      message: text.checkFields,
      fieldErrors: fieldErrorsFromZod(error)
    };
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("slug")
  ) {
    return {
      ok: false,
      message: text.articleLinkUsed,
      fieldErrors: { slug: [text.articleLinkUsedField] }
    };
  }

  return {
    ok: false,
    message: error instanceof Error ? error.message : text.saveFailed,
    fieldErrors: {}
  };
}

export async function createArticleAction(
  _previousState: ArticleActionState,
  formData: FormData
): Promise<ArticleActionState> {
  const locale = await getAdminLocale();
  const input = parseArticleForm(formData);
  const parsed = articleMutationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: actionText(locale).checkFields,
      fieldErrors: fieldErrorsFromZod(parsed.error)
    };
  }

  try {
    const user = await requireUser();
    const article = await createArticle(user, parsed.data);
    const shouldReturnToList = formData.get("returnToList") === "1" || parsed.data.status === ArticleStatus.PUBLISHED;
    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath("/admin/articles");
    return {
      ok: true,
      message: actionText(locale).articleSaved,
      fieldErrors: {},
      redirectTo: shouldReturnToList ? "/admin/articles" : `/admin/articles/${article.id}/edit`
    };
  } catch (error) {
    return actionErrorState(error, locale);
  }
}

export async function updateArticleAction(
  id: string,
  _previousState: ArticleActionState,
  formData: FormData
): Promise<ArticleActionState> {
  const locale = await getAdminLocale();
  const input = parseArticleForm(formData);
  const parsed = articleMutationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: actionText(locale).checkFields,
      fieldErrors: fieldErrorsFromZod(parsed.error)
    };
  }

  try {
    const user = await requireUser();
    const article = await updateArticle(user, id, parsed.data);
    const shouldReturnToList = formData.get("returnToList") === "1" || parsed.data.status === ArticleStatus.PUBLISHED;
    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath(`/articles/${article.slug}`);
    revalidatePath("/admin/articles");
    return {
      ok: true,
      message: actionText(locale).articleSaved,
      fieldErrors: {},
      redirectTo: shouldReturnToList ? "/admin/articles" : undefined
    };
  } catch (error) {
    return actionErrorState(error, locale);
  }
}

export async function restoreArticleVersionAction(articleId: string, versionId: string) {
  const user = await requireUser();
  const article = await restoreArticleVersion(user, articleId, versionId);
  revalidatePath("/articles");
  revalidatePath(`/articles/${article.slug}`);
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${article.id}/edit`);
  redirect(`/admin/articles/${article.id}/edit`);
}

export async function publishArticleAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await setArticleStatus(user, id, ArticleStatus.PUBLISHED);
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
}

export async function unpublishArticleAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await setArticleStatus(user, id, ArticleStatus.DRAFT);
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
}

export async function deleteArticleAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await deleteArticle(user, id);
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
}
