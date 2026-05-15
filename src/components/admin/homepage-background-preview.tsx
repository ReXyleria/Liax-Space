import { Card } from "@/components/ui/card";
import {
  resolveSiteBackgroundDetails,
  type SiteBackgroundResolution
} from "@/components/layout/site-background";
import type { SettingsMap } from "@/features/settings/types";
import type { Locale } from "@/lib/i18n";

function sourceText(locale: Locale, source: SiteBackgroundResolution["source"]) {
  const copy = locale === "en"
    ? {
        global: "Global background image",
        homepage: "Homepage background",
        random: "Random background URL",
        default: "Default background"
      }
    : {
        global: "全站背景图",
        homepage: "首页背景",
        random: "随机背景地址",
        default: "默认背景"
      };

  return copy[source];
}

export function HomepageBackgroundPreview({
  settings,
  locale = "zh-CN"
}: {
  settings: SettingsMap;
  locale?: Locale;
}) {
  const resolved = resolveSiteBackgroundDetails(settings);
  const isEnglish = locale === "en";

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        <div
          className="min-h-48 bg-cover bg-center"
          style={{ backgroundImage: `url(${resolved.src})` }}
          aria-hidden
        />
        <div className="space-y-3 p-5">
          <p className="text-sm font-medium text-primary">
            {isEnglish ? "Active homepage background" : "当前生效首页背景"}
          </p>
          <h2 className="text-xl font-semibold">{sourceText(locale, resolved.source)}</h2>
          <p className="break-all text-sm text-muted-foreground">{resolved.src}</p>
          <p className="text-xs text-muted-foreground">
            {isEnglish
              ? "Resolution order: global background, homepage background, random background, then default background."
              : "生效顺序：全站背景图、首页背景、随机背景地址、默认背景。"}
          </p>
        </div>
      </div>
    </Card>
  );
}
