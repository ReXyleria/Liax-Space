"use client";

import { useActionState, useEffect, useState } from "react";
import { SettingType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { FloatingSettingsSubmit } from "@/components/console/floating-settings-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateSettingsAction, type SettingsActionState } from "@/features/settings/actions";
import type { SettingDefinition, SettingsMap } from "@/features/settings/types";
import type { Locale } from "@/lib/i18n-messages";

function labels(locale: Locale) {
  return locale === "en"
    ? {
        imageHelper: "Supports jpg/png/webp/gif, up to 5MB.",
        enabled: "Enabled",
        disabled: "Disabled",
        saving: "Saving...",
        save: "Save settings",
        colorHint: "Choose a color and the app will map it to runtime theme variables.",
        percent: "%",
        pixels: "px"
      }
    : {
        imageHelper: "支持 jpg/png/webp/gif，最大 5MB。",
        enabled: "启用",
        disabled: "关闭",
        saving: "保存中...",
        save: "保存设置",
        colorHint: "选择颜色后，系统会自动映射到运行时主题变量。",
        percent: "%",
        pixels: "px"
      };
}

function ThemeColorField({
  definition,
  value,
  locale
}: {
  definition: SettingDefinition;
  value: string;
  locale: Locale;
}) {
  const text = labels(locale);
  const current = value || definition.defaultValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Input
          name={definition.key}
          type="color"
          defaultValue={current}
          className="h-11 w-16 cursor-pointer rounded-lg p-1"
        />
        <Input value={current} readOnly className="font-mono uppercase tracking-wide" />
      </div>
      <p className="text-xs text-muted-foreground">{text.colorHint}</p>
    </div>
  );
}

function RangeSettingField({
  definition,
  value,
  locale
}: {
  definition: SettingDefinition;
  value: string;
  locale: Locale;
}) {
  const text = labels(locale);
  const isOpacity = definition.key === "appearance.backgroundOverlayOpacity";
  const min = 0;
  const max = isOpacity ? 90 : 32;
  const fallback = Number(definition.defaultValue);
  const initial = Number.isFinite(Number(value)) ? Number(value) : fallback;
  const [current, setCurrent] = useState(String(Math.min(max, Math.max(min, initial))));

  return (
    <div className="space-y-3 rounded-lg border bg-background/70 p-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">{definition.label}</span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-mono text-primary">
          {current}
          {isOpacity ? text.percent : text.pixels}
        </span>
      </div>
      <input
        name={definition.key}
        type="range"
        min={min}
        max={max}
        step={1}
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </div>
  );
}

function FieldControl({
  definition,
  value,
  locale
}: {
  definition: SettingDefinition;
  value: string;
  locale: Locale;
}) {
  const text = labels(locale);

  if (definition.key.startsWith("theme.")) {
    return <ThemeColorField definition={definition} value={value} locale={locale} />;
  }

  if (
    definition.key === "appearance.backgroundOverlayOpacity" ||
    definition.key === "appearance.backgroundBlur"
  ) {
    return <RangeSettingField definition={definition} value={value} locale={locale} />;
  }

  if (definition.type === SettingType.IMAGE) {
    return (
      <ImageUploadField
        name={definition.key}
        label={definition.label}
        defaultValue={value}
        helper={text.imageHelper}
        compact
      />
    );
  }

  if (definition.type === SettingType.TEXTAREA || definition.type === SettingType.JSON) {
    return <Textarea name={definition.key} defaultValue={value} />;
  }

  if (definition.type === SettingType.BOOLEAN) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[
          ["true", text.enabled],
          ["false", text.disabled]
        ].map(([optionValue, label]) => (
          <label
            key={optionValue}
            className="flex cursor-pointer items-center justify-center rounded-md border bg-background px-3 py-2 text-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted active:translate-y-0 active:scale-[0.99]"
          >
            <input
              className="peer sr-only"
              type="radio"
              name={definition.key}
              value={optionValue}
              defaultChecked={value === optionValue}
            />
            <span className="peer-checked:font-semibold peer-checked:text-primary">{label}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <Input
      name={definition.key}
      type={definition.type === SettingType.PASSWORD ? "password" : "text"}
      defaultValue={value}
    />
  );
}

const initialState: SettingsActionState = { ok: false, message: "" };

export function SettingsForm({
  groups,
  settings,
  locale = "zh-CN"
}: {
  groups: Record<string, SettingDefinition[]>;
  settings: SettingsMap;
  locale?: Locale;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<SettingsActionState, FormData>(
    updateSettingsAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <form action={formAction} className="space-y-6 pb-24" aria-busy={isPending}>
      {Object.entries(groups).map(([group, definitions]) => (
        <Card key={group} className="overflow-hidden">
          <CardHeader className="border-b bg-muted/35">
            <CardTitle>{group}</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <fieldset disabled={isPending} className="grid gap-5 md:grid-cols-2">
              {definitions.map((definition) => (
                <label key={definition.key} className="space-y-2 text-sm">
                  <span className="font-medium">{definition.label}</span>
                  <FieldControl
                    definition={definition}
                    value={settings[definition.key] ?? definition.defaultValue}
                    locale={locale}
                  />
                </label>
              ))}
            </fieldset>
          </CardContent>
        </Card>
      ))}
      <FloatingSettingsSubmit pending={isPending} message={state.message} ok={state.ok} locale={locale} />
    </form>
  );
}
