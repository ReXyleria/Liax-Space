import { notFound } from "next/navigation";
import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { GuestbookForm } from "@/components/forms/guestbook-form";
import { GuestbookMessageCard } from "@/components/forms/guestbook-message-card";
import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { listApprovedGuestbookMessages } from "@/features/guestbook/service";
import { getCurrentUser } from "@/lib/auth";
import { urlLocaleToLocale } from "@/lib/locale-url";

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
  const currentUser = user
    ? {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        avatar: user.avatar
      }
    : null;

  return (
    <PublicShell locale={locale}>
      <MotionPage>
        <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[380px_1fr]">
          <section>
            <h1 className="text-4xl font-semibold">留言</h1>
            <p className="mt-3 text-muted-foreground">
              邮箱不会在前台公开。公开留言会自动通过并展示；重要留言可选择只发送给站主。
            </p>
            <GuestbookForm defaultNickname={user?.nickname ?? ""} defaultEmail={user?.email ?? ""} />
          </section>
          <section className="space-y-4">
            {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
            <MotionList className="space-y-4">
              {messages.length ? (
                messages.map((message) => (
                  <MotionItem key={message.id}>
                    <GuestbookMessageCard message={message} currentUser={currentUser} />
                  </MotionItem>
                ))
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
