import { redirect } from "next/navigation";
import { getCurrentLocale } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale-url";

export const dynamic = "force-dynamic";

export default async function RootLocaleEntryPage() {
  const locale = await getCurrentLocale();
  redirect(localizedPath(locale));
}
