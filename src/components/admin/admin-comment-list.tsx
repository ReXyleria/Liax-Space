"use client";

import { useActionState, useMemo, useState } from "react";
import { CommentStatus } from "@prisma/client";
import { ChevronDown, Pin, PinOff, Trash2, VolumeX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { formatDate } from "@/lib/utils";
import {
  type CommentActionState,
  setCommentStatusAction,
  toggleCommentPinnedAction,
  muteUserAction
} from "@/features/comments/actions";

type AdminComment = {
  id: string;
  content: string;
  status: CommentStatus;
  pinned: boolean;
  createdAt: string | Date;
  deviceName: string | null;
  article: { title: string; slug: string };
  user: {
    id: string;
    nickname: string;
    email: string;
    avatar: string | null;
    mutedUntil: string | Date | null;
  };
};

const statusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  HIDDEN: "隐藏",
  DELETED: "已删除"
};

const muteOptions = [
  { value: "1h", label: "禁言 1 小时" },
  { value: "3h", label: "禁言 3 小时" },
  { value: "5h", label: "禁言 5 小时" },
  { value: "1d", label: "禁言 1 天" },
  { value: "1mo", label: "禁言 1 个月" },
  { value: "permanent", label: "永久禁言" }
];

type ArticleGroup = {
  articleId: string;
  title: string;
  slug: string;
  comments: AdminComment[];
};

const muteInitialState: CommentActionState = { ok: false, message: "" };

export function AdminCommentList({ comments }: { comments: AdminComment[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, ArticleGroup>();
    for (const comment of comments) {
      const key = comment.article.slug || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          articleId: key,
          title: comment.article.title || "未知文章",
          slug: comment.article.slug || "",
          comments: []
        });
      }
      map.get(key)!.comments.push(comment);
    }
    return Array.from(map.values());
  }, [comments]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isExpanded = expanded.has(group.articleId);
        return (
          <Card key={group.articleId} className={`overflow-visible ${isExpanded ? "z-10" : ""}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
              onClick={() => toggleGroup(group.articleId)}
            >
              <div>
                <p className="font-medium">
                  {group.slug ? (
                    <Link
                      href={`/articles/${group.slug}`}
                      className="hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {group.title}
                    </Link>
                  ) : (
                    group.title
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {group.comments.length} 条评论
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className={isExpanded ? "overflow-visible" : "overflow-hidden"}>
                <div className="divide-y border-t">
                  {group.comments.map((comment) => (
                    <CommentRow key={comment.id} comment={comment} />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function CommentRow({ comment }: { comment: AdminComment }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [muteState, muteFormAction, mutePending] = useActionState<CommentActionState, FormData>(
    muteUserAction,
    muteInitialState
  );

  const isMuted =
    comment.user.mutedUntil && new Date(comment.user.mutedUntil) > new Date();

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {comment.user.avatar ? (
              <img
                src={comment.user.avatar}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : null}
            <span className="text-sm font-medium">{comment.user.nickname}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(comment.createdAt)}
            </span>
            {isMuted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[0.65rem] font-medium text-orange-700">
                <VolumeX className="h-2.5 w-2.5" />
                已禁言
              </span>
            ) : null}
            {comment.pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-medium text-amber-700">
                <Pin className="h-2.5 w-2.5" />
                已置顶
              </span>
            ) : null}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                comment.status === "APPROVED"
                  ? "bg-emerald-100 text-emerald-700"
                  : comment.status === "PENDING"
                    ? "bg-amber-100 text-amber-700"
                    : comment.status === "HIDDEN"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-red-100 text-red-700"
              }`}
            >
              {statusLabels[comment.status] ?? comment.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{comment.content}</p>
          {comment.deviceName ? (
            <p className="mt-1 text-[0.7rem] text-muted-foreground/60">{comment.deviceName}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form action={muteFormAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={comment.user.id} />
          <Select
            name="duration"
            defaultValue="1h"
            className="min-w-36"
            options={muteOptions}
          />
          <Button type="submit" variant="secondary" className="h-9 px-3 text-xs" disabled={mutePending}>
            {mutePending ? "禁言中..." : isMuted ? "更新禁言" : "禁言此用户"}
          </Button>
        </form>
        {muteState.message ? (
          <span className={muteState.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>
            {muteState.message}
          </span>
        ) : null}
        <form action={toggleCommentPinnedAction}>
          <input type="hidden" name="id" value={comment.id} />
          <Button
            type="submit"
            variant="ghost"
            className={`h-9 px-3 text-xs ${comment.pinned ? "text-amber-600" : ""}`}
            title={comment.pinned ? "取消置顶" : "置顶"}
          >
            {comment.pinned ? (
              <>
                <PinOff className="mr-1 h-3.5 w-3.5" />
                取消置顶
              </>
            ) : (
              <>
                <Pin className="mr-1 h-3.5 w-3.5" />
                置顶
              </>
            )}
          </Button>
        </form>
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-3 text-xs text-destructive hover:bg-destructive/10"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          删除
        </Button>
        <ConfirmActionDialog
          open={deleteOpen}
          title="确认删除评论"
          description="删除后将无法恢复，确定要删除这条评论吗？"
          confirmLabel="确认删除"
          cancelLabel="取消"
          onOpenChange={setDeleteOpen}
          action={setCommentStatusAction}
          hiddenFields={[
            { name: "id", value: comment.id },
            { name: "status", value: "DELETED" }
          ]}
        />
      </div>
    </div>
  );
}
