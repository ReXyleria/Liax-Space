import { MessageCircle, ThumbsUp } from "lucide-react";
import { GuestbookModerationForm } from "@/components/admin/guestbook-moderation-form";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { requireAdminPermission } from "@/lib/admin-guard";
import { canManageGuestbook } from "@/lib/permissions";
import { listAdminGuestbookMessages } from "@/features/guestbook/service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  HIDDEN: "已隐藏",
  DELETED: "已删除"
};

export default async function AdminGuestbookPage() {
  const user = await requireAdminPermission(canManageGuestbook, "/admin/guestbook");
  const { messages, error } = await listAdminGuestbookMessages(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">留言管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          显示所有留言，包括公开留言、仅通知站主留言、隐藏留言和已删除留言。
        </p>
      </div>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <div className="space-y-4">
        {messages.length ? (
          messages.map((message) => {
            const displayName = message.user?.nickname ?? message.nickname;
            return (
              <Card key={message.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar src={message.user?.avatar} name={displayName} className="h-10 w-10 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(message.createdAt)} · {statusLabels[message.status] ?? message.status}
                        {message.notifyOnly ? " · 仅通知" : ""}
                        {message.deletedAt ? " · 已标记删除" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {message._count.comments}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      {message._count.likes}
                    </span>
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{message.content}</p>
                {message.comments.length ? (
                  <div className="mt-4 space-y-2 rounded-md border bg-background/70 p-3">
                    <p className="text-xs font-medium text-muted-foreground">评论</p>
                    {message.comments.map((comment) => (
                      <div key={comment.id} className="rounded-md bg-muted/45 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <UserAvatar
                            src={comment.user?.avatar}
                            name={comment.user?.nickname ?? comment.nickname}
                            className="h-6 w-6 text-[0.65rem]"
                          />
                          <span className="font-medium">{comment.user?.nickname ?? comment.nickname}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                          {comment.deletedAt ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[0.65rem] text-destructive">
                              已删除
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <GuestbookModerationForm id={message.id} reply={message.reply} status={message.status} />
              </Card>
            );
          })
        ) : (
          <Card className="p-8 text-muted-foreground">暂无留言。</Card>
        )}
      </div>
    </div>
  );
}
