"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  createGuestbookCommentAction,
  toggleGuestbookLikeAction,
  type GuestbookActionState
} from "@/features/guestbook/actions";
import type { Locale } from "@/lib/i18n-messages";
import { formatDate } from "@/lib/utils";

type GuestbookCardMessage = {
  id: string;
  nickname: string;
  content: string;
  reply: string | null;
  createdAt: Date | string;
  user: { nickname: string; avatar: string | null } | null;
  comments: Array<{
    id: string;
    nickname: string;
    content: string;
    createdAt: Date | string;
    user: { nickname: string; avatar: string | null } | null;
  }>;
  likes: Array<{ userId: string }>;
  _count?: {
    comments: number;
    likes: number;
  };
};

const initialState: GuestbookActionState = {
  ok: false,
  message: "",
  fieldErrors: {}
};

function copy(locale: Locale) {
  return locale === "en"
    ? {
        ownerReply: "Owner reply:",
        loginToLike: "Sign in to like",
        comment: "Comment",
        nickname: "Nickname",
        email: "Email",
        placeholder: "Reply to this message",
        submitting: "Submitting...",
        submit: "Post comment"
      }
    : {
        ownerReply: "站主回复：",
        loginToLike: "登录后点赞",
        comment: "评论",
        nickname: "昵称",
        email: "邮箱",
        placeholder: "回复这条留言",
        submitting: "提交中...",
        submit: "发布评论"
      };
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function GuestbookMessageCard({
  message,
  currentUser,
  locale
}: {
  message: GuestbookCardMessage;
  currentUser?: { id: string; nickname: string; email: string; avatar: string | null } | null;
  locale: Locale;
}) {
  const text = copy(locale);
  const commentFormRef = useRef<HTMLFormElement>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentState, commentAction, commentPending] = useActionState<GuestbookActionState, FormData>(
    createGuestbookCommentAction,
    initialState
  );
  const [likeState, likeAction, likePending] = useActionState<GuestbookActionState, FormData>(
    toggleGuestbookLikeAction,
    initialState
  );
  const displayName = message.user?.nickname ?? message.nickname;
  const liked = useMemo(
    () => Boolean(currentUser && message.likes.some((like) => like.userId === currentUser.id)),
    [currentUser, message.likes]
  );
  const likeCount = message._count?.likes ?? message.likes.length;
  const commentCount = message.comments.length;

  useEffect(() => {
    if (commentState.ok) {
      commentFormRef.current?.reset();
      setCommentOpen(false);
    }
  }, [commentState.ok]);

  return (
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
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{message.content}</p>
      {message.reply ? (
        <div className="mt-4 rounded-md bg-muted p-3 text-sm">
          <span className="font-medium">{text.ownerReply}</span>
          {message.reply}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <form action={likeAction}>
          <input type="hidden" name="messageId" value={message.id} />
          <Button
            type="submit"
            variant={liked ? "primary" : "secondary"}
            className="h-9 px-3"
            disabled={likePending || !currentUser}
            title={currentUser ? undefined : text.loginToLike}
          >
            <Heart className={`mr-1.5 h-4 w-4 ${liked ? "fill-current" : ""}`} />
            {likeCount}
          </Button>
        </form>
        <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => setCommentOpen((open) => !open)}>
          <MessageCircle className="mr-1.5 h-4 w-4" />
          {text.comment} · {commentCount}
        </Button>
        {likeState.message ? (
          <span className={likeState.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>
            {likeState.message}
          </span>
        ) : null}
      </div>

      {message.comments.length ? (
        <div className="mt-4 space-y-3">
          {message.comments.map((comment) => {
            const commentName = comment.user?.nickname ?? comment.nickname;
            return (
              <div key={comment.id} className="rounded-md border bg-background/70 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <UserAvatar src={comment.user?.avatar} name={commentName} className="h-6 w-6 text-[0.65rem]" />
                  <span className="font-medium">{commentName}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{comment.content}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {commentOpen ? (
        <form ref={commentFormRef} action={commentAction} className="mt-4 space-y-3 rounded-md border bg-background/70 p-3">
          <input type="hidden" name="messageId" value={message.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="nickname" placeholder={text.nickname} defaultValue={currentUser?.nickname ?? ""} required maxLength={32} />
            <Input name="email" type="email" placeholder={text.email} defaultValue={currentUser?.email ?? ""} required />
          </div>
          <FieldError messages={commentState.fieldErrors.nickname} />
          <FieldError messages={commentState.fieldErrors.email} />
          <Textarea name="content" placeholder={text.placeholder} required maxLength={500} />
          <FieldError messages={commentState.fieldErrors.content} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={commentPending}>
              <Send className="mr-2 h-4 w-4" />
              {commentPending ? text.submitting : text.submit}
            </Button>
            {commentState.message ? (
              <span className={commentState.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
                {commentState.message}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </Card>
  );
}
