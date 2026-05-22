import { PrismaClient, SettingType, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/security";

const prisma = new PrismaClient();

const defaultSettings: Array<{
  key: string;
  value: string;
  group: string;
  type: SettingType;
}> = [
  { key: "site.title", value: "Liax-Space", group: "basic", type: "TEXT" },
  { key: "site.subtitle", value: "Notes on code and life.", group: "basic", type: "TEXT" },
  { key: "site.url", value: "http://localhost:3000", group: "basic", type: "TEXT" },
  { key: "site.logo", value: "", group: "basic", type: "IMAGE" },
  { key: "theme.primary", value: "#7187f3", group: "theme", type: "TEXT" },
  { key: "theme.accent", value: "#c8a2ff", group: "theme", type: "TEXT" },
  { key: "appearance.backgroundImage", value: "", group: "appearance", type: "IMAGE" },
  { key: "appearance.backgroundOverlayOpacity", value: "30", group: "appearance", type: "NUMBER" },
  { key: "appearance.backgroundBlur", value: "14", group: "appearance", type: "NUMBER" },
  { key: "site.defaultLanguage", value: "zh-CN", group: "basic", type: "TEXT" },
  { key: "site.defaultFont", value: "HarmonyOS Sans", group: "basic", type: "TEXT" },
  { key: "home.heroLine", value: "A personal notebook built for thoughtful writing.", group: "home", type: "TEXTAREA" },
  { key: "home.cover", value: "", group: "home", type: "IMAGE" },
  { key: "home.randomBackground", value: "true", group: "home", type: "BOOLEAN" },
  { key: "home.randomBackgroundUrl", value: "https://photo.toliax.com/random", group: "home", type: "TEXT" },
  { key: "record.icp", value: "", group: "record", type: "TEXT" },
  { key: "record.icpUrl", value: "https://beian.miit.gov.cn/", group: "record", type: "TEXT" },
  { key: "record.police", value: "", group: "record", type: "TEXT" },
  { key: "record.policeUrl", value: "https://www.beian.gov.cn/portal/registerSystemInfo", group: "record", type: "TEXT" },
  { key: "footer.copyright", value: "© Liax-Space", group: "footer", type: "TEXT" },
  { key: "contact.email", value: process.env.OWNER_EMAIL || "owner@example.com", group: "contact", type: "TEXT" },
  { key: "contact.github", value: "", group: "contact", type: "TEXT" },
  { key: "contact.bilibili", value: "", group: "contact", type: "TEXT" },
  { key: "contact.x", value: "", group: "contact", type: "TEXT" },
  { key: "contact.qq", value: "", group: "contact", type: "TEXT" },
  { key: "contact.wechatQr", value: "", group: "contact", type: "IMAGE" },
  { key: "smtp.host", value: "", group: "smtp", type: "TEXT" },
  { key: "smtp.port", value: "587", group: "smtp", type: "NUMBER" },
  { key: "smtp.user", value: "", group: "smtp", type: "TEXT" },
  { key: "smtp.pass", value: "", group: "smtp", type: "PASSWORD" },
  { key: "smtp.from", value: "", group: "smtp", type: "TEXT" },
  { key: "smtp.fromName", value: "", group: "smtp", type: "TEXT" },
  { key: "smtp.encryption", value: "starttls", group: "smtp", type: "TEXT" },
  { key: "smtp.notificationsEnabled", value: "true", group: "smtp", type: "BOOLEAN" },
  { key: "register.enabled", value: "true", group: "register", type: "BOOLEAN" },
  { key: "register.defaultRole", value: "USER", group: "identity", type: "TEXT" },
  { key: "comments.requireApproval", value: "true", group: "comments", type: "BOOLEAN" },
  { key: "guestbook.requireApproval", value: "true", group: "guestbook", type: "BOOLEAN" },
  { key: "translation.enabled", value: "false", group: "translation", type: "BOOLEAN" },
  { key: "translation.provider", value: "custom", group: "translation", type: "TEXT" },
  { key: "translation.baseUrl", value: "", group: "translation", type: "TEXT" },
  { key: "translation.apiKey", value: "", group: "translation", type: "PASSWORD" },
  { key: "translation.model", value: "", group: "translation", type: "TEXT" },
  { key: "translation.sourceLang", value: "zh-CN", group: "translation", type: "TEXT" },
  { key: "translation.targetLang", value: "en-US", group: "translation", type: "TEXT" },
  { key: "translation.timeoutMs", value: "30000", group: "translation", type: "NUMBER" },
  { key: "translation.maxRetries", value: "2", group: "translation", type: "NUMBER" },
  { key: "translation.autoTranslate", value: "true", group: "translation", type: "BOOLEAN" },
  { key: "translation.saveResult", value: "true", group: "translation", type: "BOOLEAN" },
  { key: "translation.chunkingEnabled", value: "true", group: "translation", type: "BOOLEAN" },
  { key: "translation.maxChunkChars", value: "3500", group: "translation", type: "NUMBER" },
  { key: "translation.chunkConcurrency", value: "2", group: "translation", type: "NUMBER" }
];

async function upsertOwner() {
  const ownerEmail = process.env.OWNER_EMAIL || "owner@example.com";
  const ownerPassword = process.env.OWNER_PASSWORD || "change-me-in-env";
  const ownerNickname = process.env.OWNER_NICKNAME || "Administer";
  const ownerUsername = process.env.OWNER_USERNAME || ownerEmail.split("@")[0] || "Administer";

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: ownerEmail },
        { username: ownerUsername }
      ]
    },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email: ownerEmail,
        username: ownerUsername,
        nickname: ownerNickname,
        role: UserRole.Administer,
        status: "ACTIVE",
        emailVerified: true
      }
    });
  }

  return prisma.user.create({
    data: {
      email: ownerEmail,
      username: ownerUsername,
      nickname: ownerNickname,
      passwordHash: await hashPassword(ownerPassword),
      role: UserRole.Administer,
      status: "ACTIVE",
      emailVerified: true
    }
  });
}

async function main() {
  const owner = await upsertOwner();

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting
    });
  }

  const notesTag = await prisma.tag.upsert({
    where: { slug: "notes" },
    update: { name: "Notes", color: "#2563eb" },
    create: { name: "Notes", slug: "notes", color: "#2563eb" }
  });

  const article = await prisma.article.upsert({
    where: { slug: "welcome-to-personal-blog" },
    update: {},
    create: {
      title: "Welcome to Liax-Space",
      slug: "welcome-to-personal-blog",
      summary: "A seeded article that proves the publishing flow is database-backed.",
      contentJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "This article was created by the Prisma seed." }]
          }
        ]
      },
      contentHtml: "<p>This article was created by the Prisma seed.</p>",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      allowComments: true,
      featured: true,
      authorId: owner.id,
      publishedAt: new Date()
    }
  });

  await prisma.articleTag.upsert({
    where: { articleId_tagId: { articleId: article.id, tagId: notesTag.id } },
    update: {},
    create: { articleId: article.id, tagId: notesTag.id }
  });

  await prisma.moment.createMany({
    data: [
      {
        content: "The first seeded moment for the blog timeline.",
        images: [],
        visibility: "PUBLIC",
        pinned: true,
        authorId: owner.id
      }
    ],
    skipDuplicates: true
  });

  const existingGuestbook = await prisma.guestbookMessage.findFirst({
    where: {
      email: "visitor@example.com",
      content: "A seeded guestbook message."
    }
  });

  if (!existingGuestbook) {
    await prisma.guestbookMessage.create({
      data: {
        nickname: "Seed Visitor",
        email: "visitor@example.com",
        content: "A seeded guestbook message.",
        status: "APPROVED"
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
