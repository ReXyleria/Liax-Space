import { MediaReferenceSource } from "@prisma/client";
import { ConsolePageHeader } from "@/components/console/console-page-header";
import { Card } from "@/components/ui/card";
import { MediaUnusedPanel } from "@/components/console/media-unused-panel";
import { RescanButton } from "@/components/console/rescan-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listMediaAssets } from "@/features/media/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConsoleDataMediaPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; source?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageSettings, "/console/data/media")
  ]);
  const { assets, error } = await listMediaAssets(user, params);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t(locale, "consoleData")}
        title={t(locale, "consoleMedia")}
        description={t(locale, "consoleMediaDescription")}
        action={<RescanButton />}
      />
      <form className="grid gap-2 md:grid-cols-[1fr_180px_180px_auto]">
        <Input name="q" placeholder={t(locale, "searchMediaPlaceholder")} defaultValue={params.q ?? ""} />
        <Select
          name="status"
          defaultValue={params.status ?? "all"}
          options={[
            { value: "all", label: t(locale, "allMedia") },
            { value: "used", label: t(locale, "usedMedia") },
            { value: "unreferenced", label: t(locale, "unreferencedMedia") }
          ]}
        />
        <Select
          name="source"
          defaultValue={params.source ?? "all"}
          options={[
            { value: "all", label: t(locale, "allSources") },
            { value: MediaReferenceSource.ARTICLE, label: t(locale, "sourceArticle") },
            { value: MediaReferenceSource.MOMENT, label: t(locale, "sourceMoment") },
            { value: MediaReferenceSource.PAGE, label: t(locale, "sourcePage") }
          ]}
        />
        <Button>{t(locale, "filter")}</Button>
      </form>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <MediaUnusedPanel
        locale={locale}
        assets={assets.map((asset) => ({
          id: asset.id,
          url: asset.url,
          filename: asset.filename,
          mimeType: asset.mimeType,
          size: asset.size,
          createdAtLabel: formatDate(asset.createdAt),
          isUnused: asset.isUnused,
          unusedSinceLabel: formatDate(asset.unusedSince),
          references: asset.references.map((reference) => ({
            source: reference.source,
            sourceId: reference.sourceId
          }))
        }))}
      />
    </div>
  );
}
