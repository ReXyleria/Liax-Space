import { SettingType } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageCodeInjection } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";

export const codeInjectionDefinitions = [
  {
    key: "code.globalHead",
    enabledKey: "code.globalHead.enabled",
    label: "全局 head 标签",
    description: "注入代码到所有页面的 head 标签部分。",
    defaultValue: ""
  },
  {
    key: "code.articleHead",
    enabledKey: "code.articleHead.enabled",
    label: "内容页 head 标签",
    description: "注入代码到文章页面和自定义页面的 head 标签部分。",
    defaultValue: ""
  },
  {
    key: "code.globalFooter",
    enabledKey: "code.globalFooter.enabled",
    label: "页脚",
    description: "注入代码到所有页面的页脚部分。",
    defaultValue: ""
  }
];

export type CodeInjectionMap = Record<string, string>;

export function getDefaultCodeInjection(): CodeInjectionMap {
  return Object.fromEntries(
    codeInjectionDefinitions.flatMap((item) => [
      [item.key, item.defaultValue],
      [item.enabledKey, "false"]
    ])
  );
}

export function isCodeInjectionEnabled(settings: CodeInjectionMap, key: string) {
  const definition = codeInjectionDefinitions.find((item) => item.key === key);
  return definition ? settings[definition.enabledKey] === "true" : false;
}

export function getEnabledCodeInjection(settings: CodeInjectionMap, key: string) {
  return isCodeInjectionEnabled(settings, key) ? settings[key] ?? "" : "";
}

export async function getCodeInjectionMap() {
  const defaults = getDefaultCodeInjection();

  if (!isDatabaseConfigured()) {
    return { settings: defaults, error: "DATABASE_URL 未配置，代码注入不可用。" };
  }

  return withDatabase(async () => {
    const keys = codeInjectionDefinitions.flatMap((item) => [item.key, item.enabledKey]);
    const rows = await db.setting.findMany({
      where: { key: { in: keys } }
    });
    return {
      settings: {
        ...defaults,
        ...Object.fromEntries(rows.map((row) => [row.key, row.value]))
      },
      error: null as string | null
    };
  }, { settings: defaults, error: "读取代码注入设置失败。" });
}

export async function updateCodeInjection(user: CurrentUser, values: CodeInjectionMap) {
  assertPermission(canManageCodeInjection(user), "仅 Administer 可以管理代码注入。");

  const allowedKeys = new Set(codeInjectionDefinitions.flatMap((item) => [item.key, item.enabledKey]));
  const updates = Object.entries(values).filter(([key]) => allowedKeys.has(key));

  await db.$transaction(
    updates.map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: {
          value: String(value),
          group: "code-injection",
          type: key.endsWith(".enabled") ? SettingType.BOOLEAN : SettingType.TEXTAREA
        },
        create: {
          key,
          value: String(value),
          group: "code-injection",
          type: key.endsWith(".enabled") ? SettingType.BOOLEAN : SettingType.TEXTAREA
        }
      })
    )
  );
}
