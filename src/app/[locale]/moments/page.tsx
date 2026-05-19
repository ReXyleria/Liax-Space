/* eslint-disable @next/next/no-img-element */

import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { MomentInteractions } from "@/components/forms/moment-interactions";
import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { listPublicMoments } from "@/features/moments/service";
import { notFound } from "next/navigation";
import { urlLocaleToLocale } from "@/lib/locale-url";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function copy(locale: "zh-CN" | "en") {
  return locale === "en"
    ? {
        title: "Moments",
        description: "A short-form timeline filtered by your current access level.",
        empty: "No moments yet.",
        unknownDevice: "Unknown device"
      }
    : {
        title: "瞬间",
        description: "短内容时间线会按身份可见性过滤。",
        empty: "暂无瞬间。",
        unknownDevice: "未知设备"
      };
}

export default async function MomentsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: urlLocale } = await params;
  const locale = urlLocaleToLocale(urlLocale);
  if (!locale) {
    notFound();
  }
  const text = copy(locale);
  const user = await getCurrentUser();
  const { moments, error } = await listPublicMoments(user, locale);

  return (
    <PublicShell locale={locale}>
      <MotionPage>
        <main className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-4xl font-semibold">{text.title}</h1>
          <p className="mt-3 text-muted-foreground">{text.description}</p>
          {error ? <Card className="mt-6 p-5 text-destructive">{error}</Card> : null}
          <MotionList className="mt-8 space-y-5">
            {moments.length ? moments.map((moment) => (
              <MotionItem key={moment.id}>
                <Card className="p-5">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{moment.author.nickname}</span>
                    <span>{formatDate(moment.createdAt)}</span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap leading-7">{moment.content}</p>
                  {Array.isArray(moment.images) && moment.images.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {moment.images.map((image) => (
                        typeof image === "string" ? <img key={image} src={image} alt="" className="h-36 rounded-md object-cover" /> : null
                      ))}
                    </div>
                  ) : null}
                  <MomentInteractions
                    momentId={moment.id}
                    likeCount={moment.likeCount}
                    liked={moment.likedByViewer}
                    canInteract={Boolean(user)}
                    locale={locale}
                  />
                  {moment.comments.length ? (
                    <div className="mt-4 space-y-3 border-t pt-4">
                      {moment.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md bg-muted/45 p-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm font-medium">{comment.user.nickname}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(comment.createdAt)} · {comment.deviceName || text.unknownDevice}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-4 text-xs text-muted-foreground">{moment.visibility}</p>
                </Card>
              </MotionItem>
            )) : <Card className="p-8 text-center text-muted-foreground">{text.empty}</Card>}
          </MotionList>
        </main>
      </MotionPage>
    </PublicShell>
  );
}
