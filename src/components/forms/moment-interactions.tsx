"use client";

import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createMomentCommentAction, toggleMomentLikeAction } from "@/features/moments/actions";

export function MomentInteractions({
  momentId,
  likeCount,
  liked,
  canInteract
}: {
  momentId: string;
  likeCount: number;
  liked: boolean;
  canInteract: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={toggleMomentLikeAction.bind(null, momentId)}>
          <Button type="submit" variant={liked ? "primary" : "secondary"} className="h-9 px-3" disabled={!canInteract}>
            <Heart className="mr-2 h-4 w-4" />
            {liked ? "已点赞" : "点赞"} · {likeCount}
          </Button>
        </form>
        <Button
          type="button"
          variant="secondary"
          className="h-9 px-3"
          onClick={() => setCommentOpen((open) => !open)}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          评论
        </Button>
        {!canInteract ? (
          <Link className="text-xs text-primary underline-offset-4 hover:underline" href="/login">
            登录后可点赞和评论
          </Link>
        ) : null}
      </div>
      {commentOpen && canInteract ? (
        <form
          ref={formRef}
          action={(formData) => {
            setMessage("");
            startTransition(async () => {
              try {
                await createMomentCommentAction(formData);
                formRef.current?.reset();
                setCommentOpen(false);
                setMessage("评论已发布。");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "评论发布失败。");
              }
            });
          }}
          className="space-y-2 rounded-lg border bg-muted/25 p-3"
        >
          <input type="hidden" name="momentId" value={momentId} />
          <Textarea name="content" placeholder="写下评论..." maxLength={600} required />
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" className="h-9 px-3" disabled={isPending}>
              {isPending ? "发布中..." : "发表评论"}
            </Button>
          </div>
        </form>
      ) : null}
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
    </div>
  );
}
