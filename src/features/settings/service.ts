import { SettingType, UserRole } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";
import type { SettingDefinition, SettingsMap } from "@/features/settings/types";
import { ensureBuiltInIdentities } from "@/features/identity/service";
import { isHighPrivilegeIdentity } from "@/lib/permission-definitions";

export const settingDefinitions: SettingDefinition[] = [
  { key: "site.title", label: "Site title", group: "Basic settings", type: SettingType.TEXT, defaultValue: "Liax-Space" },
  { key: "site.subtitle", label: "Site subtitle", group: "Basic settings", type: SettingType.TEXT, defaultValue: "Notes on code, writing, and life." },
  { key: "site.url", label: "Site URL", group: "Basic settings", type: SettingType.TEXT, defaultValue: "http://localhost:3000" },
  { key: "site.logo", label: "Site logo", group: "Basic settings", type: SettingType.IMAGE, defaultValue: "" },
  { key: "theme.primary", label: "Primary color", group: "Appearance", type: SettingType.TEXT, defaultValue: "#7187f3" },
  { key: "theme.accent", label: "Accent color", group: "Appearance", type: SettingType.TEXT, defaultValue: "#c8a2ff" },
  { key: "appearance.backgroundImage", label: "Global background image", group: "Appearance", type: SettingType.IMAGE, defaultValue: "" },
  { key: "appearance.backgroundOverlayOpacity", label: "Background overlay opacity", group: "Appearance", type: SettingType.NUMBER, defaultValue: "30" },
  { key: "appearance.backgroundBlur", label: "Background blur", group: "Appearance", type: SettingType.NUMBER, defaultValue: "14" },
  { key: "home.heroLine", label: "Homepage intro", group: "Homepage", type: SettingType.TEXTAREA, defaultValue: "A personal notebook built for thoughtful writing." },
  { key: "home.cover", label: "Homepage background", group: "Homepage", type: SettingType.IMAGE, defaultValue: "" },
  { key: "home.randomBackground", label: "Use random background when unset", group: "Homepage", type: SettingType.BOOLEAN, defaultValue: "true" },
  { key: "home.randomBackgroundUrl", label: "Random background URL", group: "Homepage", type: SettingType.TEXT, defaultValue: "https://photo.toliax.com/random" },
  { key: "record.icp", label: "ICP filing", group: "Footer", type: SettingType.TEXT, defaultValue: "" },
  { key: "record.icpUrl", label: "ICP filing URL", group: "Footer", type: SettingType.TEXT, defaultValue: "https://beian.miit.gov.cn/" },
  { key: "record.police", label: "Police filing", group: "Footer", type: SettingType.TEXT, defaultValue: "" },
  { key: "record.policeUrl", label: "Police filing URL", group: "Footer", type: SettingType.TEXT, defaultValue: "https://www.beian.gov.cn/portal/registerSystemInfo" },
  { key: "footer.brandName", label: "Footer brand name", group: "Footer", type: SettingType.TEXT, defaultValue: "" },
  { key: "footer.copyright", label: "Copyright", group: "Footer", type: SettingType.TEXT, defaultValue: "" },
  { key: "contact.showOnHome", label: "Show homepage contact card", group: "Contact", type: SettingType.BOOLEAN, defaultValue: "true" },
  { key: "contact.items", label: "Contact items", group: "Contact", type: SettingType.JSON, defaultValue: "[]" },
  { key: "contact.email", label: "Email", group: "Contact", type: SettingType.TEXT, defaultValue: "" },
  { key: "contact.github", label: "GitHub", group: "Contact", type: SettingType.TEXT, defaultValue: "" },
  { key: "contact.bilibili", label: "Bilibili", group: "Contact", type: SettingType.TEXT, defaultValue: "" },
  { key: "contact.x", label: "X", group: "Contact", type: SettingType.TEXT, defaultValue: "" },
  { key: "contact.qq", label: "QQ", group: "Contact", type: SettingType.TEXT, defaultValue: "" },
  { key: "contact.wechatQr", label: "WeChat QR", group: "Contact", type: SettingType.IMAGE, defaultValue: "" },
  { key: "smtp.host", label: "SMTP host", group: "SMTP", type: SettingType.TEXT, defaultValue: "" },
  { key: "smtp.port", label: "SMTP port", group: "SMTP", type: SettingType.NUMBER, defaultValue: "587" },
  { key: "smtp.user", label: "SMTP username", group: "SMTP", type: SettingType.TEXT, defaultValue: "" },
  { key: "smtp.pass", label: "SMTP password", group: "SMTP", type: SettingType.PASSWORD, defaultValue: "" },
  { key: "smtp.from", label: "SMTP from", group: "SMTP", type: SettingType.TEXT, defaultValue: "" },
  { key: "smtp.notificationsEnabled", label: "Enable mail notifications", group: "SMTP", type: SettingType.BOOLEAN, defaultValue: "true" },
  { key: "register.enabled", label: "Allow registration", group: "Registration", type: SettingType.BOOLEAN, defaultValue: "true" },
  { key: "comments.requireApproval", label: "Comments require approval", group: "Comments", type: SettingType.BOOLEAN, defaultValue: "true" },
  { key: "guestbook.requireApproval", label: "Guestbook requires approval", group: "Guestbook", type: SettingType.BOOLEAN, defaultValue: "true" },
  { key: "passkey.rpId", label: "Passkey RP ID", group: "Passkey", type: SettingType.TEXT, defaultValue: "localhost" },
  { key: "passkey.origin", label: "Passkey Origin", group: "Passkey", type: SettingType.TEXT, defaultValue: "http://localhost:3000" },
  { key: "passkey.rpName", label: "Passkey RP Name", group: "Passkey", type: SettingType.TEXT, defaultValue: "Liax-Space" }
];

const localizedSettingDefinitions: Record<Locale, Record<string, { label: string; group: string }>> = {
  en: Object.fromEntries(
    settingDefinitions.map((definition) => [
      definition.key,
      { label: definition.label, group: definition.group }
    ])
  ),
  "zh-CN": {
    "site.title": { label: "站点标题", group: "基础设置" },
    "site.subtitle": { label: "站点副标题", group: "基础设置" },
    "site.url": { label: "站点域名", group: "基础设置" },
    "site.logo": { label: "站点 Logo", group: "基础设置" },
    "theme.primary": { label: "主题色", group: "外观" },
    "theme.accent": { label: "强调色", group: "外观" },
    "appearance.backgroundImage": { label: "全站背景图", group: "外观" },
    "appearance.backgroundOverlayOpacity": { label: "背景遮罩不透明度", group: "外观" },
    "appearance.backgroundBlur": { label: "背景磨砂强度", group: "外观" },
    "home.heroLine": { label: "首页介绍", group: "首页" },
    "home.cover": { label: "首页背景", group: "首页" },
    "record.icp": { label: "ICP备案号", group: "页脚" },
    "record.icpUrl": { label: "ICP备案链接", group: "页脚" },
    "record.police": { label: "公安备案号", group: "页脚" },
    "record.policeUrl": { label: "公安备案链接", group: "页脚" },
    "contact.items": { label: "联系方式列表", group: "联系方式" },
    "contact.email": { label: "邮箱", group: "联系方式" },
    "contact.github": { label: "GitHub", group: "联系方式" },
    "contact.bilibili": { label: "Bilibili", group: "联系方式" },
    "contact.x": { label: "X", group: "联系方式" },
    "contact.qq": { label: "QQ", group: "联系方式" },
    "contact.wechatQr": { label: "微信二维码", group: "联系方式" },
    "smtp.host": { label: "SMTP 主机", group: "SMTP" },
    "smtp.port": { label: "SMTP 端口", group: "SMTP" },
    "smtp.user": { label: "SMTP 用户名", group: "SMTP" },
    "smtp.pass": { label: "SMTP 密码", group: "SMTP" },
    "smtp.from": { label: "发件人地址", group: "SMTP" },
    "smtp.notificationsEnabled": { label: "启用邮件通知", group: "SMTP" },
    "register.enabled": { label: "允许注册", group: "注册" },
    "comments.requireApproval": { label: "评论需要审核", group: "评论" },
    "guestbook.requireApproval": { label: "留言需要审核", group: "留言" },
    "passkey.rpId": { label: "Passkey RP ID", group: "通行密钥" },
    "passkey.origin": { label: "Passkey Origin", group: "通行密钥" },
    "passkey.rpName": { label: "Passkey RP 名称", group: "通行密钥" },
    "footer.copyright": { label: "版权声明", group: "页脚" }
  }
};

export function getLocalizedSettingDefinitions(locale: Locale = "zh-CN") {
  const localized = localizedSettingDefinitions[locale] ?? localizedSettingDefinitions["zh-CN"];
  return settingDefinitions.map((definition) => {
    const override = localized[definition.key];
    return override ? { ...definition, ...override } : definition;
  });
}

export function getDefaultSettings(): SettingsMap {
  return {
    ...Object.fromEntries(settingDefinitions.map((setting) => [setting.key, setting.defaultValue])),
    "register.defaultRole": UserRole.USER,
    "register.defaultIdentityId": ""
  };
}

async function loadSettingsMap(): Promise<{ settings: SettingsMap; error?: string }> {
  const defaults = getDefaultSettings();

  return withDatabase<{ settings: SettingsMap; error?: string }>(
    async () => {
      const rows = await db.setting.findMany();
      return {
        settings: {
          ...defaults,
          ...Object.fromEntries(rows.map((setting) => [setting.key, setting.value]))
        }
      };
    },
    {
      settings: defaults,
      error: "Failed to load settings. Default values are being used."
    }
  );
}

const getCachedSettingsMap = unstable_cache(loadSettingsMap, ["settings-map"], {
  revalidate: 30,
  tags: ["settings"]
});

export async function getSettingsMap(): Promise<{ settings: SettingsMap; error?: string }> {
  if (!isDatabaseConfigured()) {
    return {
      settings: getDefaultSettings(),
      error: "DATABASE_URL is not configured. Default values are being used."
    };
  }

  return getCachedSettingsMap();
}

export async function updateSettings(user: CurrentUser, values: SettingsMap) {
  assertPermission(canManageSettings(user), "You do not have permission to update settings.");

  const allowedKeys = new Set(settingDefinitions.map((setting) => setting.key));
  const definitionsByKey = new Map(settingDefinitions.map((setting) => [setting.key, setting]));
  const passwordKeys = settingDefinitions
    .filter((setting) => setting.type === SettingType.PASSWORD)
    .map((setting) => setting.key);

  const existingPasswords = await db.setting.findMany({
    where: { key: { in: passwordKeys } },
    select: { key: true, value: true }
  });
  const existingPasswordMap = new Map(existingPasswords.map((setting) => [setting.key, setting.value]));

  const updates = Object.entries(values).filter(([key]) => allowedKeys.has(key));

  await db.$transaction(
    updates.map(([key, value]) => {
      const definition = definitionsByKey.get(key);
      const stringValue = String(value ?? "");
      const resolvedValue =
        definition?.type === SettingType.PASSWORD &&
        (!stringValue || stringValue.includes("****")) &&
        existingPasswordMap.has(key)
          ? existingPasswordMap.get(key)!
          : stringValue;

      return db.setting.upsert({
        where: { key },
        update: {
          value: resolvedValue,
          group: definition?.group ?? "Custom",
          type: definition?.type ?? SettingType.TEXT
        },
        create: {
          key,
          value: resolvedValue,
          group: definition?.group ?? "Custom",
          type: definition?.type ?? SettingType.TEXT
        }
      });
    })
  );

  revalidateTag("settings");
}

export async function updateIdentitySettings(user: CurrentUser, defaultIdentityId: string) {
  assertPermission(canManageSettings(user), "You do not have permission to update identity settings.");

  if (!defaultIdentityId) {
    throw new Error("Select a default identity.");
  }

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensureBuiltInIdentities();
  const identity = await db.identity.findUnique({
    where: { id: defaultIdentityId }
  });

  if (!identity) {
    throw new Error("Default identity was not found.");
  }

  if (isHighPrivilegeIdentity(identity)) {
    throw new Error("Default identity cannot be a high-privilege identity.");
  }

  const updates = [
    db.setting.upsert({
      where: { key: "register.defaultIdentityId" },
      update: {
        value: identity.id,
        group: "Identity",
        type: SettingType.TEXT
      },
      create: {
        key: "register.defaultIdentityId",
        value: identity.id,
        group: "Identity",
        type: SettingType.TEXT
      }
    })
  ];

  if (identity.builtInRole) {
    updates.push(
      db.setting.upsert({
        where: { key: "register.defaultRole" },
        update: {
          value: identity.builtInRole,
          group: "Identity",
          type: SettingType.TEXT
        },
        create: {
          key: "register.defaultRole",
          value: identity.builtInRole,
          group: "Identity",
          type: SettingType.TEXT
        }
      })
    );
  }

  await db.$transaction(updates);
  revalidateTag("settings");
}
