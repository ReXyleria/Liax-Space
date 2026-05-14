import { MotionItem, MotionPage } from "@/components/animations/reveal";
import { FloatingContactCard } from "@/components/home/floating-contact-card";
import { PublicShell } from "@/components/layout/public-shell";
import { parseContactItems } from "@/features/settings/contact-items";
import { getSettingsMap } from "@/features/settings/service";
import { getOwnerProfile } from "@/features/users/service";
import { getCurrentLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [locale, { settings, error: settingsError }, { profile: ownerProfile }] = await Promise.all([
    getCurrentLocale(),
    getSettingsMap(),
    getOwnerProfile()
  ]);

  const ownerNickname = ownerProfile?.nickname || settings["site.title"] || (locale === "en" ? "Administer" : "Administer");
  const ownerAvatar = ownerProfile?.avatar || "";
  const contacts = parseContactItems(settings);

  return (
    <PublicShell transparentHeader homePage>
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

                {settings["site.subtitle"] ? (
                  <h1
                    data-home-obstacle
                    className="max-w-3xl text-5xl font-semibold leading-tight tracking-normal drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] md:text-7xl"
                  >
                    {settings["site.subtitle"]}
                  </h1>
                ) : null}

                {settingsError ? <p data-home-obstacle className="mt-4 text-sm text-red-200">{settingsError}</p> : null}
              </MotionItem>

              <FloatingContactCard locale={locale} contacts={contacts} />
            </div>
          </section>
        </main>
      </MotionPage>
    </PublicShell>
  );
}
