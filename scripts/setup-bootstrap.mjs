import { mkdir, writeFile } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient, SettingType, UserRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();
const storageRoot = process.env.APP_STORAGE_DIR || path.join(process.cwd(), "storage");
const configDir = process.env.SETUP_CONFIG_DIR || path.join(storageRoot, "config");
const setupStatusPath = path.join(configDir, "setup-status.json");

const allPermissionKeys = [
  "articles.manage",
  "comments.manage",
  "moments.manage",
  "tags.manage",
  "users.manage",
  "identities.manage",
  "settings.manage",
  "mailTemplates.manage",
  "codeInjection.manage",
  "backupRestore.manage",
  "analytics.view"
];

const defaultRolePermissions = {
  VISITOR: [],
  USER: [],
  FRIEND: [],
  VIP: [],
  EDITOR: ["articles.manage", "moments.manage", "tags.manage"],
  ADMIN: allPermissionKeys.filter((key) => key !== "codeInjection.manage"),
  OWNER: allPermissionKeys
};

const publicIdentityTiers = [
  { key: "user", name: "user", description: "Default reader identity.", builtInRole: UserRole.USER },
  { key: "svip", name: "svip", description: "Standard VIP reader identity.", builtInRole: UserRole.FRIEND },
  { key: "ssvip", name: "ssvip", description: "Top visible reader identity.", builtInRole: UserRole.VIP }
];

const defaultSettings = [
  ["site.title", "Liax-Space", "basic", SettingType.TEXT],
  ["site.subtitle", "Notes on code and life.", "basic", SettingType.TEXT],
  ["site.url", process.env.SITE_URL || "http://localhost:3000", "basic", SettingType.TEXT],
  ["site.logo", "", "basic", SettingType.IMAGE],
  ["theme.primary", "#7187f3", "theme", SettingType.TEXT],
  ["theme.accent", "#c8a2ff", "theme", SettingType.TEXT],
  ["appearance.backgroundImage", "", "appearance", SettingType.IMAGE],
  ["appearance.backgroundOverlayOpacity", "30", "appearance", SettingType.NUMBER],
  ["appearance.backgroundBlur", "14", "appearance", SettingType.NUMBER],
  ["site.defaultLanguage", "zh-CN", "basic", SettingType.TEXT],
  ["site.defaultFont", "HarmonyOS Sans", "basic", SettingType.TEXT],
  ["home.heroLine", "A personal notebook built for thoughtful writing.", "home", SettingType.TEXTAREA],
  ["home.cover", "", "home", SettingType.IMAGE],
  ["home.randomBackground", "true", "home", SettingType.BOOLEAN],
  ["home.randomBackgroundUrl", "https://photo.toliax.com/random", "home", SettingType.TEXT],
  ["record.icp", "", "record", SettingType.TEXT],
  ["record.icpUrl", "https://beian.miit.gov.cn/", "record", SettingType.TEXT],
  ["record.police", "", "record", SettingType.TEXT],
  ["record.policeUrl", "https://www.beian.gov.cn/portal/registerSystemInfo", "record", SettingType.TEXT],
  ["footer.copyright", "© Liax-Space", "footer", SettingType.TEXT],
  ["contact.email", process.env.OWNER_EMAIL || "", "contact", SettingType.TEXT],
  ["contact.github", "", "contact", SettingType.TEXT],
  ["contact.bilibili", "", "contact", SettingType.TEXT],
  ["contact.x", "", "contact", SettingType.TEXT],
  ["contact.qq", "", "contact", SettingType.TEXT],
  ["contact.wechatQr", "", "contact", SettingType.IMAGE],
  ["smtp.host", "", "smtp", SettingType.TEXT],
  ["smtp.port", "587", "smtp", SettingType.NUMBER],
  ["smtp.user", "", "smtp", SettingType.TEXT],
  ["smtp.pass", "", "smtp", SettingType.PASSWORD],
  ["smtp.from", "", "smtp", SettingType.TEXT],
  ["smtp.notificationsEnabled", "true", "smtp", SettingType.BOOLEAN],
  ["register.enabled", "true", "register", SettingType.BOOLEAN],
  ["register.defaultRole", "USER", "identity", SettingType.TEXT],
  ["comments.requireApproval", "true", "comments", SettingType.BOOLEAN],
  ["guestbook.requireApproval", "true", "guestbook", SettingType.BOOLEAN],
  ["translation.enabled", "false", "translation", SettingType.BOOLEAN],
  ["translation.provider", "custom", "translation", SettingType.TEXT],
  ["translation.baseUrl", process.env.TRANSLATION_API_URL || "", "translation", SettingType.TEXT],
  ["translation.apiKey", process.env.TRANSLATION_API_KEY || "", "translation", SettingType.PASSWORD],
  ["translation.model", process.env.TRANSLATION_MODEL || "", "translation", SettingType.TEXT],
  ["translation.sourceLang", "zh-CN", "translation", SettingType.TEXT],
  ["translation.targetLang", "en", "translation", SettingType.TEXT],
  ["translation.timeoutMs", "30000", "translation", SettingType.NUMBER],
  ["translation.maxRetries", "2", "translation", SettingType.NUMBER],
  ["translation.autoTranslate", "true", "translation", SettingType.BOOLEAN],
  ["translation.saveResult", "true", "translation", SettingType.BOOLEAN],
  ["translation.chunkingEnabled", "true", "translation", SettingType.BOOLEAN],
  ["translation.maxChunkChars", "3500", "translation", SettingType.NUMBER],
  ["translation.chunkConcurrency", "2", "translation", SettingType.NUMBER]
];

async function writeStatus(state, error) {
  await mkdir(configDir, { recursive: true });
  await writeFile(
    setupStatusPath,
    `${JSON.stringify(
      {
        state,
        updatedAt: new Date().toISOString(),
        siteUrl: process.env.SITE_URL || undefined,
        databaseHost: process.env.MYSQL_HOST || undefined,
        databaseName: process.env.MYSQL_DATABASE || undefined,
        error: error || undefined
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
}

async function ensureOwner() {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const ownerUsername = process.env.OWNER_USERNAME?.trim() || ownerEmail?.split("@")[0] || "owner";
  const ownerNickname = process.env.OWNER_NICKNAME?.trim() || "站主";

  if (!ownerEmail) {
    throw new Error("OWNER_EMAIL is required for initial setup.");
  }

  const existingOwner = await prisma.user.findFirst({
    where: { role: UserRole.OWNER },
    orderBy: { createdAt: "asc" }
  });

  if (existingOwner) {
    await prisma.user.update({
      where: { id: existingOwner.id },
      data: {
        email: ownerEmail,
        username: ownerUsername,
        nickname: ownerNickname,
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        emailVerified: true
      }
    });
    return existingOwner.id;
  }

  if (!process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD.length < 8) {
    throw new Error("OWNER_PASSWORD must be set and at least 8 characters for first setup.");
  }

  const owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      username: ownerUsername,
      nickname: ownerNickname,
      passwordHash: await bcrypt.hash(process.env.OWNER_PASSWORD, 12),
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      emailVerified: true
    }
  });
  return owner.id;
}

async function ensureSettings() {
  for (const [key, defaultValue, group, type] of defaultSettings) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: {
        key,
        value: String(defaultValue),
        group,
        type
      }
    });
  }

  if (process.env.SITE_URL) {
    const existing = await prisma.setting.findUnique({ where: { key: "site.url" } });
    if (!existing || !existing.value || existing.value === "http://localhost:3000") {
      await prisma.setting.upsert({
        where: { key: "site.url" },
        update: { value: process.env.SITE_URL, group: "basic", type: SettingType.TEXT },
        create: { key: "site.url", value: process.env.SITE_URL, group: "basic", type: SettingType.TEXT }
      });
    }
  }
}

async function ensureIdentities() {
  for (const identity of publicIdentityTiers) {
    await prisma.identity.upsert({
      where: { key: identity.key },
      update: {
        name: identity.name,
        description: identity.description,
        builtInRole: identity.builtInRole,
        permissions: defaultRolePermissions[identity.builtInRole] || []
      },
      create: {
        key: identity.key,
        name: identity.name,
        description: identity.description,
        builtInRole: identity.builtInRole,
        permissions: defaultRolePermissions[identity.builtInRole] || []
      }
    });
  }

  const userIdentity = await prisma.identity.findUnique({ where: { key: "user" }, select: { id: true } });
  if (userIdentity) {
    await prisma.setting.upsert({
      where: { key: "register.defaultIdentityId" },
      update: { value: userIdentity.id, group: "identity", type: SettingType.TEXT },
      create: { key: "register.defaultIdentityId", value: userIdentity.id, group: "identity", type: SettingType.TEXT }
    });
  }
}

async function main() {
  await ensureOwner();
  await ensureSettings();
  await ensureIdentities();
  await writeStatus("complete");
}

main()
  .catch(async (error) => {
    console.error("[setup] Bootstrap failed", error);
    await writeStatus("migration-failed", error instanceof Error ? error.message : "Bootstrap failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
