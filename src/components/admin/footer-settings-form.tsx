"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { FloatingSettingsSubmit } from "@/components/admin/floating-settings-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { updateFooterSettingsAction, type SettingsActionState } from "@/features/settings/actions";
import type { ContactItem } from "@/features/settings/contact-items";
import type { SettingsMap } from "@/features/settings/types";
import type { Locale } from "@/lib/i18n-messages";

const initialState: SettingsActionState = { ok: false, message: "" };

function copy(locale: Locale) {
  return locale === "en"
    ? {
        brandTitle: "Brand and filing",
        brandDescription: "Control the public footer brand line, copyright text, and filing links.",
        brandName: "Footer brand name",
        copyright: "Copyright text",
        copyrightHint: "Custom text is displayed as-is. Leave empty to generate the default copyright line.",
        icp: "ICP filing",
        icpUrl: "ICP filing URL",
        police: "Police filing",
        policeUrl: "Police filing URL",
        contactTitle: "Homepage contact card and contact items",
        contactDescription: "The switch only controls the floating contact card on the homepage. Contact page entries continue to use this list.",
        showOnHome: "Show homepage contact floating card",
        showOnHomeDesc: "When disabled, the homepage contact card disappears even if contact items exist.",
        add: "Add contact",
        label: "Label",
        value: "Display value",
        href: "Open link",
        kind: "Type",
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
        brandTitle: "品牌与备案",
        brandDescription: "管理公共页脚的品牌名称、版权文案和备案链接。",
        brandName: "页脚品牌名",
        copyright: "版权文案",
        copyrightHint: "自定义文案会原样显示；留空时自动生成默认版权行。",
        icp: "ICP备案号",
        icpUrl: "ICP备案链接",
        police: "公安备案号",
        policeUrl: "公安备案链接",
        contactTitle: "首页悬浮联系方式与联系方式列表",
        contactDescription: "开关只控制首页联系方式悬浮窗；联系页仍按这里的联系方式列表展示。",
        showOnHome: "首页显示联系方式悬浮窗",
        showOnHomeDesc: "关闭后，即使存在联系方式，首页也不会显示悬浮联系方式卡片。",
        add: "新增联系方式",
        label: "名称",
        value: "展示内容",
        href: "点击链接",
        kind: "类型",
        hrefHint: "请输入完整 URL；邮箱类型可以使用 mailto: 链接。",
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

export function FooterSettingsForm({
  settings,
  initialItems,
  locale = "zh-CN"
}: {
  settings: SettingsMap;
  initialItems: ContactItem[];
  locale?: Locale;
}) {
  const text = copy(locale);
  const [items, setItems] = useState<ContactItem[]>(
    initialItems.length ? initialItems.map((item) => ({ ...item, enabled: true })) : [createItem(0)]
  );
  const [state, action, isPending] = useActionState<SettingsActionState, FormData>(
    updateFooterSettingsAction,
    initialState
  );

  const kindOptions = useMemo(
    () => [
      { value: "custom", label: text.kinds.custom },
      { value: "email", label: text.kinds.email },
      { value: "github", label: text.kinds.github },
      { value: "bilibili", label: text.kinds.bilibili },
      { value: "x", label: text.kinds.x },
      { value: "qq", label: text.kinds.qq },
      { value: "website", label: text.kinds.website }
    ],
    [text]
  );

  function updateItem(id: string, patch: Partial<ContactItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch, enabled: true } : item)));
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
    <form action={action} className="space-y-6 pb-24">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(items.map((item, index) => ({ ...item, enabled: true, sort: index })))}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/35">
          <CardTitle>{text.brandTitle}</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">{text.brandDescription}</p>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.brandName}</span>
            <Input name="footer.brandName" defaultValue={settings["footer.brandName"] ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.copyright}</span>
            <Input name="footer.copyright" defaultValue={settings["footer.copyright"] ?? ""} />
            <p className="text-xs text-muted-foreground">{text.copyrightHint}</p>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.icp}</span>
            <Input name="record.icp" defaultValue={settings["record.icp"] ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.icpUrl}</span>
            <Input name="record.icpUrl" defaultValue={settings["record.icpUrl"] ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.police}</span>
            <Input name="record.police" defaultValue={settings["record.police"] ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.policeUrl}</span>
            <Input name="record.policeUrl" defaultValue={settings["record.policeUrl"] ?? ""} />
          </label>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/35">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>{text.contactTitle}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">{text.contactDescription}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setItems((current) => [...current, createItem(current.length)])}
            >
              <Plus className="mr-2 h-4 w-4" />
              {text.add}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <ThemedCheckbox
            name="contact.showOnHome"
            label={text.showOnHome}
            description={text.showOnHomeDesc}
            defaultChecked={settings["contact.showOnHome"] !== "false"}
          />

          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border bg-background/80 p-4">
              <div className="mb-4 flex flex-wrap justify-end gap-2">
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

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.kind}</span>
                  <Select
                    name={`${item.id}-kind`}
                    value={item.kind}
                    onValueChange={(kind) => updateItem(item.id, { kind: kind as ContactItem["kind"] })}
                    options={kindOptions}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.label}</span>
                  <Input value={item.label} onChange={(event) => updateItem(item.id, { label: event.target.value })} />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.value}</span>
                  <Input value={item.value} onChange={(event) => updateItem(item.id, { value: event.target.value })} />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.href}</span>
                  <Input value={item.href} onChange={(event) => updateItem(item.id, { href: event.target.value })} />
                  <p className="text-xs text-muted-foreground">{text.hrefHint}</p>
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <FloatingSettingsSubmit pending={isPending} message={state.message} ok={state.ok} locale={locale} />
    </form>
  );
}
