import { AdminCommentList } from "@/components/admin/admin-comment-list";
import { Card } from "@/components/ui/card";
import { requireAdminPermission } from "@/lib/admin-guard";
import { t } from "@/lib/i18n";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageComments } from "@/lib/permissions";
import { listAdminComments } from "@/features/comments/service";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  const user = await requireAdminPermission(canManageComments, "/admin/comments");
  const locale = await getAdminLocale();
  const { comments, error } = await listAdminComments(user);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{t(locale, "adminCommentManagement")}</h1>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      {comments.length ? (
        <AdminCommentList comments={comments} />
      ) : (
        <Card className="p-8 text-center text-muted-foreground">{t(locale, "adminCommentEmpty")}</Card>
      )}
    </div>
  );
}
