import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { GuestbookForm } from "@/components/forms/guestbook-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { listApprovedGuestbookMessages } from "@/features/guestbook/service";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { urlLocaleToLocale } from "@/lib/locale-url";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GuestbookPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: urlLocale } = await params;
  const locale = urlLocaleToLocale(urlLocale);
  if (!locale) {
    notFound();
  }

  const [{ messages, error }, user] = await Promise.all([
    listApprovedGuestbookMessages(),
    getCurrentUser()
  ]);

  return (
    <PublicShell locale={locale}>
      <MotionPage>
        <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[380px_1fr]">
          <section>
            <h1 className="text-4xl font-semibold">留言</h1>
            <p className="mt-3 text-muted-foreground">
              邮箱不会在前台公开，如果是重要的留言不会展示而且会直接发送到我的邮箱，我会尽快回复的qwq
            </p>
            <GuestbookForm defaultNickname={user?.nickname ?? ""} defaultEmail={user?.email ?? ""} />
          </section>
          <section className="space-y-4">
            {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
            <MotionList className="space-y-4">
              {messages.length ? (
                messages.map((message) => {
                  const displayName = message.user?.nickname ?? message.nickname;

                  return (
                    <MotionItem key={message.id}>
                      <Card className="p-5">
                        <div className="flex items-start justify-between gap-4 text-sm">
                          <div className="flex min-w-0 items-center gap-3">
                            <UserAvatar
                              src={message.user?.avatar}
                              name={displayName}
                              className="h-10 w-10 shrink-0 text-xs"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{displayName}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {message.content}
                        </p>
                        {message.reply ? (
                          <div className="mt-4 rounded-md bg-muted p-3 text-sm">
                            <span className="font-medium">站主回复：</span>
                            {message.reply}
                          </div>
                        ) : null}
                      </Card>
                    </MotionItem>
                  );
                })
              ) : (
                <Card className="p-8 text-center text-muted-foreground">暂无公开留言。</Card>
              )}
            </MotionList>
          </section>
        </main>
      </MotionPage>
    </PublicShell>
  );
}
