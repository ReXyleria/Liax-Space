import { ConsolePageHeader } from "@/components/console/console-page-header";
import { ConsoleMomentManager } from "@/components/console/console-moment-manager";
import { requireConsolePermission } from "@/lib/console-guard";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageMoments } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { listConsoleMoments } from "@/features/moments/service";

export const dynamic = "force-dynamic";

function text(locale: "zh-CN" | "en") {
  return locale === "en"
    ? {
        eyebrow: "Content",
        title: "Moments",
        description: "Publish, edit, and remove short updates without leaving the console workspace."
      }
    : {
        eyebrow: "内容",
        title: "瞬间",
        description: "在后台直接发布、编辑和删除短动态，不再拆成半成品列表。"
      };
}

export default async function ConsoleMomentsPage() {
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageMoments, "/console/moments")
  ]);
  const copy = text(locale);
  const { moments, error } = await listConsoleMoments(user);

  return (
    <div className="space-y-6">
      <ConsolePageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ConsoleMomentManager
        locale={locale}
        moments={moments.map((moment) => ({
          id: moment.id,
          content: moment.content,
          images: Array.isArray(moment.images) ? moment.images.filter((item): item is string => typeof item === "string") : [],
          visibility: moment.visibility,
          pinned: moment.pinned,
          createdAtLabel: formatDate(moment.createdAt),
          createdAtIso: moment.createdAt.toISOString().slice(0, 16),
          authorName: moment.author.nickname
        }))}
      />
    </div>
  );
}
