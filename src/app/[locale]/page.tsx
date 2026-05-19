import { PublicContentTranslationEntity } from "@prisma/client";
import { notFound } from "next/navigation";
import { MotionItem, MotionPage } from "@/components/animations/reveal";
import { FloatingContactCard } from "@/components/home/floating-contact-card";
import { PublicShell } from "@/components/layout/public-shell";
import { getPublicContentTranslationMap, translatedField } from "@/features/i18n/public-content-translations";
import { parseContactItems } from "@/features/settings/contact-items";
import { shouldShowHomeContactCard } from "@/features/settings/footer";
import { getSettingsMap } from "@/features/settings/service";
import { getOwnerProfile } from "@/features/users/service";
import { urlLocaleToLocale } from "@/lib/locale-url";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: urlLocale } = await params;
  const locale = urlLocaleToLocale(urlLocale);
  if (!locale) {
    notFound();
  }

  const [{ settings, error: settingsError }, { profile: ownerProfile }] = await Promise.all([
    getSettingsMap(),
    getOwnerProfile()
  ]);

  const ownerNickname = ownerProfile?.nickname || settings["site.title"] || (locale === "en" ? "Owner" : "站主");
  const ownerAvatar = ownerProfile?.avatar || "";
  const contacts = parseContactItems(settings)
    .filter((contact) => contact.enabled)
    .sort((left, right) => left.sort - right.sort);
  const [contactTranslations, settingTranslations] = await Promise.all([
    getPublicContentTranslationMap(
      PublicContentTranslationEntity.SETTING,
      locale,
      contacts.map((contact) => `contact:${contact.id}`)
    ),
    getPublicContentTranslationMap(PublicContentTranslationEntity.SETTING, locale, ["site.subtitle"])
  ]);
  const localizedContacts = contacts.map((contact) => ({
    ...contact,
    label: translatedField(contactTranslations, `contact:${contact.id}`, "label", contact.label)
  }));
  const subtitle = translatedField(settingTranslations, "site.subtitle", "value", settings["site.subtitle"]);
  const showContactCard = shouldShowHomeContactCard(settings) && contacts.length > 0;

  return (
    <PublicShell transparentHeader homePage locale={locale}>
      <MotionPage className="h-full">
        <main className="h-full">
          <section className="relative h-full overflow-hidden text-white">
            <div className="relative mx-auto grid h-full max-w-6xl items-center gap-10 px-6 pb-28 pt-24 lg:grid-cols-[minmax(0,1fr)_360px]">
              <MotionItem>
                <div
                  data-home-obstacle
                  className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm shadow-soft backdrop-blur-xl"
                >
                  <span
                    className="h-9 w-9 rounded-full bg-white/16 ring-1 ring-white/25"
                    style={
                      ownerAvatar
                        ? {
                            backgroundImage: `url(${ownerAvatar})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center"
                          }
                        : undefined
                    }
                  />
                  <span className="font-medium">{ownerNickname}</span>
                </div>

                {subtitle ? (
                  <h1
                    data-home-obstacle
                    className="max-w-3xl text-5xl font-semibold leading-tight tracking-normal drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] md:text-7xl"
                  >
                    {subtitle}
                  </h1>
                ) : null}

                {settingsError ? <p data-home-obstacle className="mt-4 text-sm text-red-200">{settingsError}</p> : null}
              </MotionItem>

              {showContactCard ? <FloatingContactCard locale={locale} contacts={localizedContacts} /> : null}
            </div>
          </section>
        </main>
      </MotionPage>
    </PublicShell>
  );
}
