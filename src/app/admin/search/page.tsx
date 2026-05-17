import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { searchAdminContent } from "@/features/admin-search/service";
import { requireAdminAccess } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

function labels(locale: Awaited<ReturnType<typeof getAdminLocale>>) {
  return locale === "en"
    ? {
        title: "Search",
        description: "Search admin content you are allowed to manage.",
        empty: "No results found.",
        emptyHint: "Try another keyword or open the related admin section directly.",
        missing: "Enter a keyword in the top search bar."
      }
    : {
        title: "后台搜索",
        description: "搜索你有权限管理的后台内容。",
        empty: "没有找到结果。",
        emptyHint: "可以换一个关键词，或直接打开对应后台分类。",
        missing: "请在顶部搜索栏输入关键词。"
      };
}

export default async function AdminSearchPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminAccess("/admin/search")
  ]);
  const text = labels(locale);
  const query = params.q?.trim() ?? "";
  const { groups, error } = query
    ? await searchAdminContent(user, query, locale)
    : { groups: [], error: null as string | null };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={locale === "en" ? "Admin" : "后台"}
        title={query ? `${text.title}: ${query}` : text.title}
        description={text.description}
      />

      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}

      {!query ? (
        <Card className="p-8 text-sm text-muted-foreground">{text.missing}</Card>
      ) : groups.length ? (
        <div className="grid gap-5">
          {groups.map((group) => (
            <Card key={group.key} className="overflow-hidden">
              <div className="border-b bg-muted/35 px-5 py-4">
                <h2 className="font-semibold">{group.label}</h2>
              </div>
              <div className="divide-y">
                {group.results.map((result) => (
                  <Link
                    key={`${group.key}-${result.id}`}
                    href={result.href}
                    className="block p-5 transition hover:bg-muted/55"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{result.title}</p>
                        {result.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{result.description}</p>
                        ) : null}
                      </div>
                      {result.meta ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {result.meta}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="space-y-2 p-8 text-center">
          <p className="font-medium">{text.empty}</p>
          <p className="text-sm text-muted-foreground">{text.emptyHint}</p>
        </Card>
      )}
    </div>
  );
}
