"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  translateArticle,
  upsertManualArticleTranslation
} from "@/features/articles/translation-service";

export type ArticleTranslationActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const translationEditSchema = z.object({
  articleId: z.string().min(1),
  locale: z.string().min(1),
  title: z.string().trim().min(1, "Translation title is required."),
  summary: z.string().optional().nullable(),
  contentHtml: z.string().min(1, "Translation content is required."),
  contentJson: z.unknown()
});

function parseEditorJson(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? "{}"));
  } catch {
    return { type: "doc", content: [] };
  }
}

function zodFieldErrors(error: ZodError) {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

export async function translateArticleAction(
  _previousState: ArticleTranslationActionState,
  formData: FormData
): Promise<ArticleTranslationActionState> {
  try {
    const user = await requireUser();
    const articleId = String(formData.get("articleId") ?? "");
    const locale = String(formData.get("locale") ?? "en");
    await translateArticle(user, articleId, locale);
    revalidatePath(`/admin/articles/${articleId}/edit`);
    revalidatePath("/articles");
    return { ok: true, message: "译文已重新生成。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "翻译失败。"
    };
  }
}

export async function updateArticleTranslationAction(
  _previousState: ArticleTranslationActionState,
  formData: FormData
): Promise<ArticleTranslationActionState> {
  const parsed = translationEditSchema.safeParse({
    articleId: formData.get("articleId"),
    locale: formData.get("locale") ?? "en",
    title: formData.get("title"),
    summary: formData.get("summary") ?? "",
    contentHtml: formData.get("translationContentHtml") ?? formData.get("contentHtml") ?? "",
    contentJson: parseEditorJson(formData.get("translationContentJson") ?? formData.get("contentJson"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "请检查译文表单。",
      fieldErrors: zodFieldErrors(parsed.error)
    };
  }

  try {
    const user = await requireUser();
    await upsertManualArticleTranslation(user, {
      ...parsed.data,
      contentJson: parsed.data.contentJson ?? { type: "doc", content: [] }
    });
    revalidatePath(`/admin/articles/${parsed.data.articleId}/edit`);
    revalidatePath("/articles");
    return { ok: true, message: "译文已保存。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "译文保存失败。",
      fieldErrors: {}
    };
  }
}
