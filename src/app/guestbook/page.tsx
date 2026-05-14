import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { GuestbookForm } from "@/components/forms/guestbook-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { listApprovedGuestbookMessages } from "@/features/guestbook/service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GuestbookPage() {
  const { messages, error } = await listApprovedGuestbookMessages();

  return (
    <PublicShell>
      <MotionPage>
        <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[380px_1fr]">
          <section>
            <h1 className="text-4xl font-semibold">留言</h1>
            <p className="mt-3 text-muted-foreground">邮箱不会在前台公开，留言可能需要审核。</p>
            <GuestbookForm />
          </section>
          <section className="space-y-4">
            {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
            <MotionList className="space-y-4">
              {messages.length ? (
                messages.map((message) => (
                  <MotionItem key={message.id}>
                    <Card className="p-5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{message.nickname}</span>
                        <span className="text-muted-foreground">{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
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
