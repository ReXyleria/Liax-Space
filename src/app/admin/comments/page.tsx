import { CommentStatusForm } from "@/components/admin/comment-status-form";
import { Card } from "@/components/ui/card";
import { requireAdminPermission } from "@/lib/admin-guard";
import { canManageComments } from "@/lib/permissions";
import { listAdminComments } from "@/features/comments/service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  const user = await requireAdminPermission(canManageComments, "/admin/comments");
  const { comments, error } = await listAdminComments(user);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">评论管理</h1>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <Card className="divide-y overflow-hidden">
        {comments.length ? comments.map((comment) => (
          <div key={comment.id} className="p-5">
            <p className="text-sm text-muted-foreground">{comment.article.title} · {comment.user.nickname} · {formatDate(comment.createdAt)}</p>
            <p className="mt-2">{comment.content}</p>
            <CommentStatusForm id={comment.id} status={comment.status} />
          </div>
        )) : <div className="p-8 text-center text-muted-foreground">暂无评论。</div>}
      </Card>
    </div>
  );
}
