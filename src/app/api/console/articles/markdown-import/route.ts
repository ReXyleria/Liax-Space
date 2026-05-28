import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageArticles } from "@/lib/permissions";
import { importMarkdownArticle, MarkdownImportError } from "@/features/articles/markdown-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function labels(locale: Awaited<ReturnType<typeof getConsoleLocale>>) {
  return locale === "en"
    ? {
        forbidden: "Permission denied.",
        imported: "Markdown article imported.",
        importedWithImageFailures: (count: number) => `Markdown article imported, but ${count} image(s) could not be localized.`,
        checkFields: "Please check the highlighted fields.",
        failed: "Markdown import failed."
      }
    : {
        forbidden: "权限不足。",
        imported: "Markdown 文章已导入。",
        importedWithImageFailures: (count: number) => `Markdown 文章已导入，但有 ${count} 张图片未能本地化。`,
        checkFields: "请检查高亮字段。",
        failed: "Markdown 导入失败。"
      };
}

export async function POST(request: Request) {
  const locale = await getConsoleLocale();
  const text = labels(locale);

  try {
    const user = await requireUser();
    if (!canManageArticles(user)) {
      return apiError(new Error(text.forbidden), {
        status: 403,
        code: "MARKDOWN_IMPORT_FORBIDDEN",
        fallback: text.forbidden
      });
    }

    const formData = await request.formData();
    const result = await importMarkdownArticle(user, {
      file: formData.get("markdownFile"),
      fallbackSourceLocale: String(formData.get("fallbackSourceLocale") ?? "zh-CN")
    });

    revalidatePath("/console/articles");

    return NextResponse.json({
      ok: true,
      message: result.imageFailures.length
        ? text.importedWithImageFailures(result.imageFailures.length)
        : text.imported,
      redirectTo: `/console/articles/${result.article.id}/edit`,
      imageFailureCount: result.imageFailures.length
    });
  } catch (error) {
    if (error instanceof MarkdownImportError) {
      return NextResponse.json({
        ok: false,
        message: error.message,
        fieldErrors: error.field ? { [error.field]: [error.message] } : {}
      }, { status: 400 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json({
        ok: false,
        message: text.checkFields,
        fieldErrors: error.flatten().fieldErrors
      }, { status: 400 });
    }

    return apiError(error, {
      status: 400,
      code: "MARKDOWN_IMPORT_FAILED",
      fallback: text.failed
    });
  }
}
