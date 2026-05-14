"use client";

import { useActionState } from "react";
import { TranslationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  translateArticleAction,
  type ArticleTranslationActionState
} from "@/features/articles/translation-actions";

type TranslationItem = {
  id: string;
  locale: string;
  title: string;
  status: TranslationStatus;
  error: string | null;
  updatedAtLabel: string;
};

const initialState: ArticleTranslationActionState = {
  ok: false,
  message: ""
};

const statusLabels: Record<TranslationStatus, string> = {
  NOT_TRANSLATED: "未翻译 / 已过期",
  TRANSLATING: "翻译中",
  TRANSLATED: "已翻译",
  FAILED: "翻译失败"
};

export function ArticleTranslationPanel({
  articleId,
  configured,
  translations
}: {
  articleId: string;
  configured: boolean;
  translations: TranslationItem[];
}) {
  const [state, formAction, isPending] = useActionState<ArticleTranslationActionState, FormData>(
    translateArticleAction,
    initialState
  );

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">文章翻译状态</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            翻译会在文章保存后自动生成并保存到数据库。这里的按钮仅用于失败后的手动重试。
          </p>
        </div>
        <form action={formAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="articleId" value={articleId} />
          <Button name="locale" value="en" type="submit" variant="secondary" disabled={!configured || isPending}>
            重新生成英文
          </Button>
          <Button name="locale" value="zh-CN" type="submit" variant="secondary" disabled={!configured || isPending}>
            重新生成中文
          </Button>
        </form>
      </div>
      {!configured ? (
        <p className="mt-4 rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
          翻译服务尚未启用或配置不完整。请先在“系统 / 翻译设置”中配置 API Base URL、API Key 和模型。
        </p>
      ) : null}
      {state.message ? (
        <p className={state.ok ? "mt-4 text-sm text-emerald-600" : "mt-4 text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <div className="mt-4 space-y-2">
        {translations.length ? translations.map((translation) => (
          <div key={translation.id} className="rounded-md border bg-background p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{translation.locale} · {translation.title}</span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {statusLabels[translation.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">更新时间：{translation.updatedAtLabel}</p>
            {translation.error ? <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{translation.error}</p> : null}
          </div>
        )) : <p className="text-sm text-muted-foreground">暂无翻译记录。保存文章后系统会按配置自动生成。</p>}
      </div>
    </Card>
  );
}
