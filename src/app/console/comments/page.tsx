import { ConsoleCommentList } from "@/components/console/console-comment-list";
import { Card } from "@/components/ui/card";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageComments } from "@/lib/permissions";
import { listConsoleComments } from "@/features/comments/service";

export const dynamic = "force-dynamic";

export default async function ConsoleCommentsPage() {
  const user = await requireConsolePermission(canManageComments, "/console/comments");
  const locale = await getConsoleLocale();
  const { comments, error } = await listConsoleComments(user);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{t(locale, "consoleCommentManagement")}</h1>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      {comments.length ? (
        <ConsoleCommentList comments={comments} locale={locale} />
      ) : (
        <Card className="p-8 text-center text-muted-foreground">{t(locale, "consoleCommentEmpty")}</Card>
      )}
    </div>
  );
}
