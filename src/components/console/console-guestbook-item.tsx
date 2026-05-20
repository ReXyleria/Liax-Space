"use client";

import { useActionState, useEffect, useState } from "react";
import { GuestbookStatus } from "@prisma/client";
import { ChevronDown, ChevronUp, EyeOff, MessageCircle, Reply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  deleteGuestbookMessageAction,
  hideGuestbookMessageAction,
  replyGuestbookMessageAction,
  type GuestbookActionState
} from "@/features/guestbook/actions";
import { formatDate } from "@/lib/utils";

type ConsoleGuestbookMessage = {
  id: string;
  nickname: string;
  email: string;
  content: string;
  reply: string | null;
  notifyOnly: boolean;
  status: GuestbookStatus;
  createdAt: Date | string;
  deletedAt: Date | string | null;
  user: { nickname: string; avatar: string | null } | null;
  comments: Array<{
    id: string;
    nickname: string;
    email: string;
    content: string;
    createdAt: Date | string;
    deletedAt: Date | string | null;
    user: { nickname: string; avatar: string | null } | null;
  }>;
  _count: {
    comments: number;
    likes: number;
  };
};

const initialState: GuestbookActionState = { ok: false, message: "", fieldErrors: {} };

const statusLabels: Record<GuestbookStatus, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  HIDDEN: "已隐藏",
  DELETED: "已删除"
};

function StateMessage({ state }: { state: GuestbookActionState }) {
  if (!state.message) {
    return null;
  }

  return <span className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</span>;
}

export function ConsoleGuestbookItem({ message }: { message: ConsoleGuestbookMessage }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hideState, hideAction, hidePending] = useActionState(hideGuestbookMessageAction, initialState);
  const [replyState, replyAction, replyPending] = useActionState(replyGuestbookMessageAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteGuestbookMessageAction, initialState);
  const displayName = message.user?.nickname ?? message.nickname;

  useEffect(() => {
    if (replyState.ok) {
      setReplyOpen(false);
    }
  }, [replyState.ok]);

  useEffect(() => {
    if (deleteState.ok) {
      setDeleteOpen(false);
    }
  }, [deleteState.ok]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar src={message.user?.avatar} name={displayName} className="h-10 w-10 text-xs" />
          <div className="min-w-0">
            <p className="truncate font-medium">{displayName}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(message.createdAt)} / {statusLabels[message.status] ?? message.status}
              {message.notifyOnly ? " / 仅通知" : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{message.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {message._count.comments}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1">点赞 {message._count.likes}</span>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{message.content}</p>
      {message.reply ? (
        <div className="mt-4 rounded-md bg-muted/55 p-3 text-sm">
          <span className="font-medium">站主回复：</span>
          {message.reply}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <form action={hideAction}>
          <input type="hidden" name="id" value={message.id} />
          <input type="hidden" name="reply" value={message.reply ?? ""} />
          <Button type="submit" variant="secondary" disabled={hidePending || message.status === GuestbookStatus.HIDDEN}>
            <EyeOff className="mr-2 h-4 w-4" />
            隐藏
          </Button>
        </form>
        <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </Button>
        <Button type="button" variant="secondary" onClick={() => setReplyOpen((open) => !open)}>
          <Reply className="mr-2 h-4 w-4" />
          回复
        </Button>
        <Button type="button" variant="ghost" onClick={() => setCommentsOpen((open) => !open)}>
          {commentsOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
          {commentsOpen ? "收起评论" : `查看评论（${message.comments.length}）`}
        </Button>
        <StateMessage state={hideState} />
        <StateMessage state={deleteState} />
      </div>

      {replyOpen ? (
        <form action={replyAction} className="mt-4 space-y-3 rounded-md border bg-background/70 p-3">
          <input type="hidden" name="id" value={message.id} />
          <Textarea name="reply" placeholder="写给留言者的回复" defaultValue={message.reply ?? ""} />
          {replyState.fieldErrors.reply?.[0] ? <p className="text-xs text-destructive">{replyState.fieldErrors.reply[0]}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={replyPending}>{replyPending ? "保存中..." : "保存回复"}</Button>
            <StateMessage state={replyState} />
          </div>
        </form>
      ) : null}

      {commentsOpen ? (
        <div className="mt-4 space-y-2 rounded-md border bg-background/70 p-3">
          {message.comments.length ? message.comments.map((comment) => {
            const commentName = comment.user?.nickname ?? comment.nickname;
            return (
              <div key={comment.id} className="rounded-md bg-muted/45 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <UserAvatar
                    src={comment.user?.avatar}
                    name={commentName}
                    className="h-6 w-6 text-[0.65rem]"
                  />
                  <span className="font-medium">{commentName}</span>
                  <span className="text-xs text-muted-foreground">{comment.email}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                  {comment.deletedAt ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[0.65rem] text-destructive">
                      已删除
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{comment.content}</p>
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">暂无评论。</p>}
        </div>
      ) : null}

      <ConfirmActionDialog
        open={deleteOpen}
        title="确认删除留言"
        description="删除后会永久移除这条留言及其评论、点赞和翻译任务记录。隐藏才会继续保留在后台。"
        confirmLabel="删除"
        cancelLabel="取消"
        pending={deletePending}
        onOpenChange={setDeleteOpen}
        action={deleteAction}
        hiddenFields={[{ name: "id", value: message.id }]}
      />
    </Card>
  );
}
