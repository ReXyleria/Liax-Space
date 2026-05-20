import { ConsolePageHeader } from "@/components/console/console-page-header";
import { TagManager } from "@/components/console/tag-manager";
import { Card } from "@/components/ui/card";
import { requireConsolePermission } from "@/lib/console-guard";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageArticles } from "@/lib/permissions";
import { listConsoleTags } from "@/features/tags/service";

export const dynamic = "force-dynamic";

function text(locale: "zh-CN" | "en") {
  return locale === "en"
    ? {
        eyebrow: "Content",
        title: "Tags",
        description: "Create, edit, color, and delete article tags. Deleting a tag detaches it from linked articles first."
      }
    : {
        eyebrow: "内容",
        title: "标签",
        description: "在这里创建、编辑、改色和删除文章标签。删除标签时会先解除关联文章。"
      };
}

export default async function ConsoleTagsPage() {
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageArticles, "/console/tags")
  ]);
  const copy = text(locale);
  const { tags, error } = await listConsoleTags(user);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <TagManager
        locale={locale}
        tags={tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          color: tag.color,
          articleCount: tag._count.articles
        }))}
      />
    </div>
  );
}
