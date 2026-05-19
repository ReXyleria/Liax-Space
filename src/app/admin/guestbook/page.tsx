import { AdminGuestbookItem } from "@/components/admin/admin-guestbook-item";
import { Card } from "@/components/ui/card";
import { requireAdminPermission } from "@/lib/admin-guard";
import { canManageGuestbook } from "@/lib/permissions";
import { listAdminGuestbookMessages } from "@/features/guestbook/service";

export const dynamic = "force-dynamic";

export default async function AdminGuestbookPage() {
  const user = await requireAdminPermission(canManageGuestbook, "/admin/guestbook");
  const { messages, error } = await listAdminGuestbookMessages(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">留言管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          显示公开留言、仅通知站主留言和隐藏留言。删除会永久移除留言及其评论、点赞记录；只有隐藏会继续保留在后台。
        </p>
      </div>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <div className="space-y-4">
        {messages.length ? (
          messages.map((message) => <AdminGuestbookItem key={message.id} message={message} />)
        ) : (
          <Card className="p-8 text-muted-foreground">暂无留言。</Card>
        )}
      </div>
    </div>
  );
}
