"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { updateContactItemsAction, type SettingsActionState } from "@/features/settings/actions";
import type { ContactItem } from "@/features/settings/contact-items";
import type { Locale } from "@/lib/i18n-messages";

const initialState: SettingsActionState = { ok: false, message: "" };

function text(locale: Locale) {
  return locale === "en"
    ? {
        title: "Contact items",
        description: "Add, remove, reorder, and configure the links shown on the homepage, contact page, and footer.",
        add: "Add contact",
        enabled: "Visible",
        label: "Label",
        value: "Display value",
        href: "Open link",
        kind: "Type",
        save: "Save contacts",
        saving: "Saving...",
        hrefHint: "Use a full URL. Email entries can use mailto: links.",
        kinds: {
          custom: "Custom",
          email: "Email",
          github: "GitHub",
          bilibili: "Bilibili",
          x: "X",
          qq: "QQ",
          website: "Website"
        }
      }
    : {
        title: "联系方式列表",
        description: "在这里新增、删除、排序，并配置首页、联系页和页脚公开显示的联系方式。",
        add: "新增联系方式",
        enabled: "显示",
        label: "名称",
        value: "展示内容",
        href: "点击链接",
        kind: "类型",
        save: "保存联系方式",
        saving: "保存中...",
        hrefHint: "请输入完整 URL，邮箱类型也可以使用 mailto: 链接。",
        kinds: {
          custom: "自定义",
          email: "邮箱",
          github: "GitHub",
          bilibili: "Bilibili",
          x: "X",
          qq: "QQ",
          website: "网站"
        }
      };
}

function createItem(index: number): ContactItem {
  return {
    id: `contact-${Date.now()}-${index}`,
    label: "",
    value: "",
    href: "",
    kind: "custom",
    enabled: true,
    sort: index
  };
}

export function ContactItemsForm({
  locale = "zh-CN",
  initialItems
}: {
  locale?: Locale;
  initialItems: ContactItem[];
}) {
  const copy = text(locale);
  const [items, setItems] = useState<ContactItem[]>(initialItems.length ? initialItems : [createItem(0)]);
  const [state, action, isPending] = useActionState<SettingsActionState, FormData>(
    updateContactItemsAction,
    initialState
  );

  const kindOptions = useMemo(
    () => [
      { value: "custom", label: copy.kinds.custom },
      { value: "email", label: copy.kinds.email },
      { value: "github", label: copy.kinds.github },
      { value: "bilibili", label: copy.kinds.bilibili },
      { value: "x", label: copy.kinds.x },
      { value: "qq", label: copy.kinds.qq },
      { value: "website", label: copy.kinds.website }
    ],
    [copy]
  );

  function updateItem(id: string, patch: Partial<ContactItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function moveItem(id: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(items.map((item, index) => ({ ...item, sort: index })))}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/35">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{copy.title}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setItems((current) => [...current, createItem(current.length)])}
            >
              <Plus className="mr-2 h-4 w-4" />
              {copy.add}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border bg-background/80 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <ThemedCheckbox
                  name={`${item.id}-enabled`}
                  checked={item.enabled}
                  onCheckedChange={(enabled) => updateItem(item.id, { enabled })}
                  label={copy.enabled}
                  className="max-w-xs"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => moveItem(item.id, -1)} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={index === items.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{copy.kind}</span>
                  <Select
                    name={`${item.id}-kind`}
                    value={item.kind}
                    onValueChange={(kind) => updateItem(item.id, { kind: kind as ContactItem["kind"] })}
                    options={kindOptions}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{copy.label}</span>
                  <Input value={item.label} onChange={(event) => updateItem(item.id, { label: event.target.value })} />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{copy.value}</span>
                  <Input value={item.value} onChange={(event) => updateItem(item.id, { value: event.target.value })} />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{copy.href}</span>
                  <Input value={item.href} onChange={(event) => updateItem(item.id, { href: event.target.value })} />
                  <p className="text-xs text-muted-foreground">{copy.hrefHint}</p>
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? copy.saving : copy.save}
      </Button>
    </form>
  );
}
