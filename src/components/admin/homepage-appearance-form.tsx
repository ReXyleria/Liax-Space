"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fallbackBackground,
  resolveSiteBackgroundDetails,
  type SiteBackgroundResolution
} from "@/components/layout/site-background";
import { updateSettingsAction, type SettingsActionState } from "@/features/settings/actions";
import type { SettingsMap } from "@/features/settings/types";
import type { Locale } from "@/lib/i18n-messages";

const initialState: SettingsActionState = { ok: false, message: "" };

function sourceLabel(locale: Locale, source: SiteBackgroundResolution["source"]) {
  const labels = locale === "en"
    ? {
        global: "Global background",
        homepage: "Homepage background",
        random: "Random background URL",
        default: "Default fallback"
      }
    : {
        global: "全站背景",
        homepage: "首页背景",
        random: "随机背景地址",
        default: "默认兜底背景"
      };

  return labels[source];
}

function RangeField({
  name,
  label,
  value,
  min,
  max,
  suffix
}: {
  name: string;
  label: string;
  value: string;
  min: number;
  max: number;
  suffix: string;
}) {
  const initial = Number.isFinite(Number(value)) ? Number(value) : min;
  const [current, setCurrent] = useState(String(Math.min(max, Math.max(min, initial))));

  return (
    <label className="space-y-3 rounded-md border bg-background/65 p-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-mono text-primary">
          {current}
          {suffix}
        </span>
      </div>
      <input
        name={name}
        type="range"
        min={min}
        max={max}
        step={1}
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </label>
  );
}

function ColorField({ name, label, value }: { name: string; label: string; value: string }) {
  const [current, setCurrent] = useState(value);

  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <div className="grid gap-2 sm:grid-cols-[72px_1fr]">
        <Input
          name={name}
          type="color"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          className="h-11 w-full cursor-pointer rounded-md p-1"
        />
        <Input value={current} readOnly className="font-mono uppercase" />
      </div>
    </label>
  );
}

function RandomBackgroundSwitch({ enabled, locale }: { enabled: boolean; locale: Locale }) {
  const text = locale === "en"
    ? { label: "Random fallback", enabled: "Enabled", disabled: "Disabled" }
    : { label: "随机背景兜底", enabled: "启用", disabled: "关闭" };

  return (
    <div className="space-y-2 text-sm">
      <span className="font-medium">{text.label}</span>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["true", text.enabled],
          ["false", text.disabled]
        ].map(([value, label]) => (
          <label
            key={value}
            className="flex h-10 cursor-pointer items-center justify-center rounded-md border bg-background px-3 text-sm transition hover:border-primary/40 hover:bg-muted active:scale-[0.99]"
          >
            <input
              className="peer sr-only"
              type="radio"
              name="home.randomBackground"
              value={value}
              defaultChecked={enabled === (value === "true")}
            />
            <span className="peer-checked:font-semibold peer-checked:text-primary">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function HomepageAppearanceForm({
  settings,
  locale = "zh-CN"
}: {
  settings: SettingsMap;
  locale?: Locale;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<SettingsActionState, FormData>(
    updateSettingsAction,
    initialState
  );
  const resolved = useMemo(() => resolveSiteBackgroundDetails(settings), [settings]);
  const isEnglish = locale === "en";
  const randomEnabled = settings["home.randomBackground"] !== "false";
  const randomUrl = settings["home.randomBackgroundUrl"]?.trim() || fallbackBackground;

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <form action={formAction} className="space-y-6" aria-busy={isPending}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="overflow-hidden">
          <div className="grid min-h-[360px] lg:grid-cols-[minmax(280px,420px)_1fr]">
            <div
              className="min-h-64 bg-cover bg-center"
              style={{ backgroundImage: `url(${resolved.src})` }}
              aria-hidden
            />
            <div className="space-y-5 p-5">
              <div>
                <p className="text-sm font-medium text-primary">
                  {isEnglish ? "Effective homepage background" : "当前生效首页背景"}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{sourceLabel(locale, resolved.source)}</h2>
              </div>
              <label className="space-y-2 text-sm">
                <span className="font-medium">{isEnglish ? "Current effective URL" : "当前生效地址"}</span>
                <Input value={resolved.src} readOnly className="font-mono text-xs" />
              </label>
              <div className="grid gap-5">
                <ImageUploadField
                  name="appearance.backgroundImage"
                  label={isEnglish ? "Global background image" : "全站背景图"}
                  defaultValue={settings["appearance.backgroundImage"] ?? ""}
                  helper={isEnglish ? "Highest priority. Leave empty to use homepage or random background." : "最高优先级。留空后会继续读取首页背景或随机背景。"}
                  compact
                />
                <ImageUploadField
                  name="home.cover"
                  label={isEnglish ? "Homepage background image" : "首页背景图"}
                  defaultValue={settings["home.cover"] ?? ""}
                  helper={isEnglish ? "Used when the global background is empty." : "当全站背景为空时生效。"}
                  compact
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-primary">{isEnglish ? "Fallback" : "兜底背景"}</p>
              <h2 className="mt-1 text-xl font-semibold">{isEnglish ? "Random image source" : "随机图片来源"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isEnglish
                  ? "This URL is used when both global and homepage backgrounds are empty."
                  : "当全站背景和首页背景都为空时，会使用这里的地址。"}
              </p>
            </div>
            <RandomBackgroundSwitch enabled={randomEnabled} locale={locale} />
            <label className="space-y-2 text-sm">
              <span className="font-medium">{isEnglish ? "Random background URL" : "随机背景地址"}</span>
              <Input name="home.randomBackgroundUrl" defaultValue={randomUrl} className="font-mono text-xs" />
            </label>
          </div>
        </Card>

        <Card className="p-5">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-primary">{isEnglish ? "Readability" : "可读性"}</p>
              <h2 className="mt-1 text-xl font-semibold">{isEnglish ? "Overlay and blur" : "遮罩与磨砂"}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <RangeField
                name="appearance.backgroundOverlayOpacity"
                label={isEnglish ? "Overlay opacity" : "背景遮罩不透明度"}
                value={settings["appearance.backgroundOverlayOpacity"] ?? "30"}
                min={0}
                max={90}
                suffix="%"
              />
              <RangeField
                name="appearance.backgroundBlur"
                label={isEnglish ? "Background blur" : "背景磨砂强度"}
                value={settings["appearance.backgroundBlur"] ?? "14"}
                min={0}
                max={32}
                suffix="px"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-primary">{isEnglish ? "Theme" : "主题色"}</p>
              <h2 className="mt-1 text-xl font-semibold">{isEnglish ? "Brand colors" : "品牌颜色"}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField name="theme.primary" label={isEnglish ? "Primary color" : "主色"} value={settings["theme.primary"] ?? "#7187f3"} />
              <ColorField name="theme.accent" label={isEnglish ? "Accent color" : "强调色"} value={settings["theme.accent"] ?? "#c8a2ff"} />
            </div>
          </div>
        </Card>
      </div>

      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {isPending
          ? isEnglish ? "Saving..." : "保存中..."
          : isEnglish ? "Save appearance" : "保存外观设置"}
      </Button>
    </form>
  );
}
