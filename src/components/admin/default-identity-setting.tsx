"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { updateIdentitySettingsAction, type SettingsActionState } from "@/features/settings/actions";

type ToastState = {
  tone: "success" | "error";
  message: string;
};

type DefaultIdentitySettingProps = {
  title: string;
  description: string;
  saveLabel: string;
  emptyLabel: string;
  options: SelectOption[];
  defaultValue?: string;
  settingsError?: string | null;
};

const initialState: SettingsActionState = { ok: false, message: "" };

export function DefaultIdentitySetting({
  title,
  description,
  saveLabel,
  emptyLabel,
  options,
  defaultValue,
  settingsError
}: DefaultIdentitySettingProps) {
  const [state, setState] = useState<SettingsActionState>(initialState);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const initialValue = useMemo(() => {
    if (defaultValue && options.some((option) => option.value === defaultValue)) {
      return defaultValue;
    }
    return options[0]?.value ?? "";
  }, [defaultValue, options]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  return (
    <div className="relative">
      {toast ? (
        <div
          className={
            toast.tone === "success"
              ? "fixed right-6 top-6 z-50 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg"
              : "fixed right-6 top-6 z-50 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-lg"
          }
        >
          {toast.message}
        </div>
      ) : null}

      <form
        className="space-y-4 rounded-lg border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            try {
              const result = await updateIdentitySettingsAction(formData);
              setState(result);
              setToast({
                tone: result.ok ? "success" : "error",
                message: result.message
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : "保存默认身份失败。";
              setState({ ok: false, message });
              setToast({ tone: "error", message });
            }
          });
        }}
      >
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {settingsError ? <p className="text-sm text-destructive">{settingsError}</p> : null}
        {options.length ? (
          <Select name="defaultIdentityId" options={options} defaultValue={initialValue} />
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
        {state.message ? (
          <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
        ) : null}
        <Button type="submit" disabled={isPending || !options.length}>
          {isPending ? "保存中..." : saveLabel}
        </Button>
      </form>
    </div>
  );
}
