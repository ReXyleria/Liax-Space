import { z } from "zod";
import type { SettingsMap } from "@/features/settings/types";

export const contactItemSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().max(40, "联系方式名称不能超过 40 个字符。"),
  value: z.string().max(200, "联系方式内容不能超过 200 个字符。"),
  href: z.string().max(500, "跳转链接不能超过 500 个字符。"),
  kind: z.string().trim().min(1).max(30),
  enabled: z.boolean().default(true),
  sort: z.number().int().min(0).default(0)
}).refine((data) => {
  if (!data.enabled) return true;
  return data.label.trim().length > 0 && data.value.trim().length > 0 && data.href.trim().length > 0;
}, {
  message: "启用的联系方式必须填写名称、内容和链接。",
  path: ["enabled"]
});

export const contactItemsSchema = z.array(contactItemSchema).max(20, "最多保留 20 条联系方式。");

export type ContactItem = z.infer<typeof contactItemSchema>;

function normalizeHref(kind: string, value: string) {
  if (!value) {
    return "";
  }

  if (kind === "email") {
    return value.startsWith("mailto:") ? value : `mailto:${value}`;
  }

  return value;
}

function legacyContactItems(settings: SettingsMap): ContactItem[] {
  const legacy = [
    { kind: "email", label: "Email", value: settings["contact.email"] ?? "" },
    { kind: "github", label: "GitHub", value: settings["contact.github"] ?? "" },
    { kind: "bilibili", label: "Bilibili", value: settings["contact.bilibili"] ?? "" },
    { kind: "x", label: "X", value: settings["contact.x"] ?? "" },
    { kind: "qq", label: "QQ", value: settings["contact.qq"] ?? "" }
  ].filter((item) => item.value);

  return legacy.map((item, index) => ({
    id: `${item.kind}-${index}`,
    label: item.label,
    value: item.value,
    href: normalizeHref(item.kind, item.value),
    kind: item.kind,
    enabled: true,
    sort: index
  }));
}

export function parseContactItems(settings: SettingsMap): ContactItem[] {
  const raw = settings["contact.items"]?.trim();

  if (!raw) {
    return legacyContactItems(settings);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = contactItemsSchema.safeParse(parsed);

    if (!result.success) {
      return legacyContactItems(settings);
    }

    return result.data.sort((left, right) => left.sort - right.sort);
  } catch {
    return legacyContactItems(settings);
  }
}

export function serializeContactItems(items: ContactItem[]) {
  return JSON.stringify(
    items.map((item, index) => ({
      ...item,
      sort: index
    }))
  );
}
