import { MediaReferenceSource } from "@prisma/client";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { MediaUnusedPanel } from "@/components/admin/media-unused-panel";
import { RescanButton } from "@/components/admin/rescan-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listMediaAssets } from "@/features/media/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale, t } from "@/lib/i18n";
import { canManageSettings } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDataMediaPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; source?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageSettings, "/admin/data/media")
  ]);
  const { assets, error } = await listMediaAssets(user, params);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t(locale, "adminData")}
        title={t(locale, "adminMedia")}
        description={t(locale, "adminMediaDescription")}
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
