"use client";

import { useMemo, useState } from "react";
import { CommentStatus } from "@prisma/client";
import { ChevronDown, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { setCommentStatusAction, toggleCommentPinnedAction } from "@/features/comments/actions";

type AdminComment = {
  id: string;
  content: string;
  status: CommentStatus;
  pinned: boolean;
  createdAt: string | Date;
  deviceName: string | null;
  article: { title: string; slug: string };
  user: { nickname: string; email: string; avatar: string | null };
};

const statusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  HIDDEN: "隐藏",
  DELETED: "已删除"
};

type ArticleGroup = {
  articleId: string;
  title: string;
  slug: string;
  comments: AdminComment[];
};

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
          <Card key={group.articleId} className="overflow-visible">
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
            {isExpanded && (
              <div className="divide-y border-t">
                {group.comments.map((comment) => (
                  <CommentRow key={comment.id} comment={comment} />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function CommentRow({ comment }: { comment: AdminComment }) {
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
        <form action={setCommentStatusAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={comment.id} />
          <Select
            name="status"
            defaultValue={comment.status}
            className="min-w-32"
            options={Object.values(CommentStatus).map((s) => ({
              value: s,
              label: statusLabels[s] ?? s
            }))}
          />
          <Button type="submit" variant="secondary" className="h-9 px-3 text-xs">
            更新状态
          </Button>
        </form>
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
        <form action={setCommentStatusAction}>
          <input type="hidden" name="id" value={comment.id} />
          <input type="hidden" name="status" value="DELETED" />
          <Button
            type="submit"
            variant="ghost"
            className="h-9 px-3 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            删除
          </Button>
        </form>
      </div>
    </div>
  );
}
