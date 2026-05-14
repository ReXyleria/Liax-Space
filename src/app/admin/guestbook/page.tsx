import { GuestbookModerationForm } from "@/components/admin/guestbook-moderation-form";
import { Card } from "@/components/ui/card";
import { requireAdminPermission } from "@/lib/admin-guard";
import { canManageGuestbook } from "@/lib/permissions";
import { listAdminGuestbookMessages } from "@/features/guestbook/service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminGuestbookPage() {
  const user = await requireAdminPermission(canManageGuestbook, "/admin/guestbook");
  const { messages, error } = await listAdminGuestbookMessages(user);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">留言管理</h1>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <div className="space-y-4">
        {messages.length ? messages.map((message) => (
          <Card key={message.id} className="p-5">
            <p className="text-sm text-muted-foreground">{message.nickname} · {formatDate(message.createdAt)} · {message.status}</p>
            <p className="mt-2">{message.content}</p>
            <GuestbookModerationForm id={message.id} reply={message.reply} status={message.status} />
          </Card>
        )) : <Card className="p-8 text-muted-foreground">暂无留言。</Card>}
      </div>
    </div>
  );
}
