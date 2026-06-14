import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import type { Article, ArticleLocale, ArticleTranslation, CreateArticleInput, CreateArticleTranslationInput, ListTranslationsInput, UpdateArticleTranslationInput, UpdateCurrentVersionInput, UpdatePublishedVersionInput } from "../articles/articles.types.js";
import type { Attachment, CreateAttachmentInput } from "../attachments/attachments.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import type { UserRecord } from "../users/users.types.js";
import type { ArticleVersion, ArticleVersionLocale, ArticleVersionSummary, CreateArticleVersionInput, ReplaceVersionAttachmentsInput, UpdatePublishedRenderResultInput, UpdateRenderStatusInput } from "../versions/versions.types.js";

type TestModules = {
  AttachmentService: typeof import("../attachments/AttachmentService.js").AttachmentService;
  ArticleService: typeof import("../articles/ArticleService.js").ArticleService;
  ArticleVersionService: typeof import("../versions/ArticleVersionService.js").ArticleVersionService;
  AuthService: typeof import("../auth/AuthService.js").AuthService;
  JwtService: typeof import("../auth/JwtService.js").JwtService;
  PublicArticleController: typeof import("../public-site/PublicArticleController.js").PublicArticleController;
  PublishService: typeof import("../publisher/PublishService.js").PublishService;
  SetupService: typeof import("../setup/SetupService.js").SetupService;
  UserController: typeof import("../users/UserController.js").UserController;
  UserService: typeof import("../users/UserService.js").UserService;
};

type RenderedHtml = {
  html: string;
  usedAttachments: Array<{ id: number; publicUrl: string }>;
  rendererVersion: string;
  templateVersion: string;
  customRuleVersion: string;
  renderHash: string;
};

const setupToken = "setup-token-for-integration";
let tempRoot = "";
let modulesPromise: Promise<TestModules>;

function setTestEnvironment(root: string): void {
  process.env.APP_ENV = "test";
  process.env.APP_PORT = "3100";
  process.env.DATABASE_HOST = "127.0.0.1";
  process.env.DATABASE_PORT = "3306";
  process.env.DATABASE_NAME = "liax_test";
  process.env.DATABASE_USER = "liax_test";
  process.env.DATABASE_PASSWORD = "liax_test";
  process.env.JWT_SECRET = "integration-test-jwt-secret";
  process.env.PASSWORD_PEPPER = "integration-test-pepper";
  process.env.PUBLIC_BASE_URL = "https://example.test";
  process.env.STORAGE_UPLOADS_DIR = path.join(root, "uploads");
  process.env.STORAGE_RENDERED_DIR = path.join(root, "rendered");
  process.env.STORAGE_RUNTIME_DIR = path.join(root, "runtime");
}

async function loadModules(): Promise<TestModules> {
  const [
    articleServiceModule,
    articleVersionServiceModule,
    attachmentServiceModule,
    authServiceModule,
    jwtServiceModule,
    publicArticleControllerModule,
    publishServiceModule,
    setupServiceModule,
    userControllerModule,
    userServiceModule
  ] = await Promise.all([
    import("../articles/ArticleService.js"),
    import("../versions/ArticleVersionService.js"),
    import("../attachments/AttachmentService.js"),
    import("../auth/AuthService.js"),
    import("../auth/JwtService.js"),
    import("../public-site/PublicArticleController.js"),
    import("../publisher/PublishService.js"),
    import("../setup/SetupService.js"),
    import("../users/UserController.js"),
    import("../users/UserService.js")
  ]);

  return {
    AttachmentService: attachmentServiceModule.AttachmentService,
    ArticleService: articleServiceModule.ArticleService,
    ArticleVersionService: articleVersionServiceModule.ArticleVersionService,
    AuthService: authServiceModule.AuthService,
    JwtService: jwtServiceModule.JwtService,
    PublicArticleController: publicArticleControllerModule.PublicArticleController,
    PublishService: publishServiceModule.PublishService,
    SetupService: setupServiceModule.SetupService,
    UserController: userControllerModule.UserController,
    UserService: userServiceModule.UserService
  };
}

function cloneDate(value: Date | null): Date | null {
  return value ? new Date(value) : null;
}

function cloneUser(user: UserRecord): UserRecord {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    disabledAt: cloneDate(user.disabledAt),
    lastLoginAt: cloneDate(user.lastLoginAt),
    updatedAt: new Date(user.updatedAt)
  };
}

function cloneArticle(article: Article): Article {
  return {
    ...article,
    createdAt: new Date(article.createdAt),
    deletedAt: cloneDate(article.deletedAt),
    updatedAt: new Date(article.updatedAt)
  };
}

function cloneTranslation(translation: ArticleTranslation): ArticleTranslation {
  return {
    ...translation,
    allowedRoles: [...translation.allowedRoles],
    createdAt: new Date(translation.createdAt),
    publishedAt: cloneDate(translation.publishedAt),
    updatedAt: new Date(translation.updatedAt)
  };
}

function cloneVersion(version: ArticleVersion): ArticleVersion {
  return {
    ...version,
    createdAt: new Date(version.createdAt)
  };
}

class MemoryUserRepository {
  private nextId = 1;
  private readonly users = new Map<number, UserRecord>();

  async createUser(input: { username: string; email: string; passwordHash: string; role: UserRecord["role"] }): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      createdAt: now,
      disabledAt: null,
      email: input.email,
      id: this.nextId,
      lastLoginAt: null,
      passwordHash: input.passwordHash,
      role: input.role,
      updatedAt: now,
      username: input.username
    };

    this.nextId += 1;
    this.users.set(user.id, user);
    return cloneUser(user);
  }

  async findById(id: number): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? cloneUser(user) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((item) => item.email === email);
    return user ? cloneUser(user) : null;
  }

  async findByEmailOrUsername(identifier: string): Promise<UserRecord | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = [...this.users.values()].find((item) => (
      item.email.toLowerCase() === normalizedIdentifier || item.username.toLowerCase() === normalizedIdentifier
    ));

    return user ? cloneUser(user) : null;
  }

  async findAdminUser(): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((item) => item.role === "admin");
    return user ? cloneUser(user) : null;
  }

  async updateLastLoginAt(id: number): Promise<UserRecord | null> {
    const user = this.users.get(id);

    if (!user) {
      return null;
    }

    user.lastLoginAt = new Date();
    user.updatedAt = new Date();
    return cloneUser(user);
  }

  async disableUser(id: number): Promise<UserRecord | null> {
    const user = this.users.get(id);

    if (!user) {
      return null;
    }

    user.disabledAt = new Date();
    user.updatedAt = new Date();
    return cloneUser(user);
  }

  async listUsers(input: { search?: string } = {}): Promise<UserRecord[]> {
    const search = input.search?.trim().toLowerCase();

    return [...this.users.values()]
      .filter((user) => !search || user.username.toLowerCase().includes(search) || user.email.toLowerCase().includes(search))
      .map(cloneUser);
  }

  async updateUserRole(input: { id: number; role: UserRecord["role"] }): Promise<UserRecord | null> {
    const user = this.users.get(input.id);

    if (!user) {
      return null;
    }

    user.role = input.role;
    user.updatedAt = new Date();
    return cloneUser(user);
  }

  async updateManyRoles(ids: number[], role: UserRecord["role"]): Promise<number> {
    let updated = 0;

    for (const id of ids) {
      const user = this.users.get(id);

      if (!user) {
        continue;
      }

      user.role = role;
      user.updatedAt = new Date();
      updated += 1;
    }

    return updated;
  }

  async disableManyUsers(ids: number[]): Promise<number> {
    let disabled = 0;

    for (const id of ids) {
      const user = this.users.get(id);

      if (!user || user.disabledAt !== null) {
        continue;
      }

      user.disabledAt = new Date();
      user.updatedAt = new Date();
      disabled += 1;
    }

    return disabled;
  }
}

class MemoryAttachmentRepository {
  private nextId = 1;
  readonly attachments = new Map<number, Attachment & { used: boolean }>();

  async createAttachment(input: CreateAttachmentInput & { used?: boolean }): Promise<Attachment> {
    const attachment: Attachment & { used: boolean } = {
      createdAt: new Date(),
      deletedAt: null,
      id: this.nextId,
      mimeType: input.mimeType,
      originalFilename: input.originalFilename,
      ownerId: input.ownerId,
      publicUrl: input.publicUrl ?? null,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      used: input.used ?? false
    };

    this.nextId += 1;
    this.attachments.set(attachment.id, attachment);
    return attachment;
  }

  async listAttachments(input: { search?: string; unusedOnly?: boolean } = {}): Promise<Attachment[]> {
    const search = input.search?.trim().toLowerCase();

    return [...this.attachments.values()]
      .filter((attachment) => attachment.deletedAt === null)
      .filter((attachment) => !input.unusedOnly || !attachment.used)
      .filter((attachment) => !search || attachment.originalFilename.toLowerCase().includes(search))
      .map(({ used: _used, ...attachment }) => ({ ...attachment }));
  }

  async softDeleteMany(ids: number[]): Promise<number> {
    let deleted = 0;

    for (const id of ids) {
      const attachment = this.attachments.get(id);

      if (!attachment || attachment.used || attachment.deletedAt !== null) {
        continue;
      }

      attachment.deletedAt = new Date();
      deleted += 1;
    }

    return deleted;
  }
}

class MemoryArticleRepository {
  private nextId = 1;
  readonly articles = new Map<number, Article>();

  async createArticle(input: CreateArticleInput): Promise<Article> {
    const now = new Date();
    const article: Article = {
      authorId: input.authorId,
      coverAttachmentId: input.coverAttachmentId ?? null,
      createdAt: now,
      deletedAt: null,
      id: this.nextId,
      status: input.status ?? "draft",
      updatedAt: now
    };

    this.nextId += 1;
    this.articles.set(article.id, article);
    return cloneArticle(article);
  }

  async findById(id: number): Promise<Article | null> {
    const article = this.articles.get(id);
    return article && !article.deletedAt ? cloneArticle(article) : null;
  }

  async listArticles(): Promise<Article[]> {
    return [...this.articles.values()].filter((article) => !article.deletedAt).map(cloneArticle);
  }

  async softDeleteArticle(id: number): Promise<Article | null> {
    const article = this.articles.get(id);

    if (!article) {
      return null;
    }

    article.deletedAt = new Date();
    article.updatedAt = new Date();
    return cloneArticle(article);
  }
}

class MemoryTranslationRepository {
  private nextId = 1;
  readonly translations = new Map<string, ArticleTranslation>();

  constructor(private readonly articleRepository?: MemoryArticleRepository) {}

  private key(articleId: number, locale: ArticleLocale): string {
    return `${articleId}:${locale}`;
  }

  async createTranslation(input: CreateArticleTranslationInput): Promise<ArticleTranslation> {
    const now = new Date();
    const translation: ArticleTranslation = {
      articleId: input.articleId,
      allowedRoles: input.allowedRoles ?? [],
      createdAt: now,
      currentHtmlPath: null,
      currentVersionId: null,
      id: this.nextId,
      locale: input.locale,
      publishedAt: null,
      publishedVersionId: null,
      seoDescription: input.seoDescription ?? null,
      seoTitle: input.seoTitle ?? null,
      slug: input.slug,
      summary: input.summary ?? null,
      title: input.title,
      updatedAt: now
    };

    this.nextId += 1;
    this.translations.set(this.key(input.articleId, input.locale), translation);
    return cloneTranslation(translation);
  }

  async findByArticleAndLocale(articleId: number, locale: ArticleLocale): Promise<ArticleTranslation | null> {
    const translation = this.translations.get(this.key(articleId, locale));
    return translation ? cloneTranslation(translation) : null;
  }

  async findByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<ArticleTranslation | null> {
    const translation = [...this.translations.values()].find((item) => item.locale === locale && item.slug === slug);
    return translation ? cloneTranslation(translation) : null;
  }

  async findPublicByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<ArticleTranslation | null> {
    const translation = await this.findByLocaleAndSlug(locale, slug);

    if (!translation) {
      return null;
    }

    if (!this.articleRepository) {
      return translation;
    }

    return await this.articleRepository.findById(translation.articleId) ? translation : null;
  }

  async listTranslations(input: ListTranslationsInput = {}): Promise<ArticleTranslation[]> {
    return [...this.translations.values()]
      .filter((translation) => input.articleId === undefined || translation.articleId === input.articleId)
      .filter((translation) => input.locale === undefined || translation.locale === input.locale)
      .map(cloneTranslation);
  }

  async updateTranslation(input: UpdateArticleTranslationInput): Promise<ArticleTranslation | null> {
    const translation = this.translations.get(this.key(input.articleId, input.locale));

    if (!translation) {
      return null;
    }

    if (input.title !== undefined) {
      translation.title = input.title;
    }

    if (input.slug !== undefined) {
      translation.slug = input.slug;
    }

    if (input.seoTitle !== undefined) {
      translation.seoTitle = input.seoTitle;
    }

    if (input.seoDescription !== undefined) {
      translation.seoDescription = input.seoDescription;
    }

    if (input.summary !== undefined) {
      translation.summary = input.summary;
    }

    if (input.allowedRoles !== undefined) {
      translation.allowedRoles = input.allowedRoles;
    }

    if (input.publishedAt !== undefined) {
      translation.publishedAt = input.publishedAt;
    }

    translation.updatedAt = new Date();
    return cloneTranslation(translation);
  }

  async updateCurrentVersion(input: UpdateCurrentVersionInput): Promise<ArticleTranslation | null> {
    const translation = this.translations.get(this.key(input.articleId, input.locale));

    if (!translation) {
      return null;
    }

    translation.currentVersionId = input.currentVersionId;
    translation.updatedAt = new Date();
    return cloneTranslation(translation);
  }

  async updatePublishedVersion(input: UpdatePublishedVersionInput): Promise<ArticleTranslation | null> {
    const translation = this.translations.get(this.key(input.articleId, input.locale));

    if (!translation) {
      return null;
    }

    translation.currentHtmlPath = input.currentHtmlPath;
    translation.allowedRoles = input.allowedRoles ?? translation.allowedRoles;
    translation.publishedAt = input.publishedAt ?? null;
    translation.publishedVersionId = input.publishedVersionId;
    translation.updatedAt = new Date();
    return cloneTranslation(translation);
  }
}

class MemoryVersionRepository {
  private nextId = 1;
  readonly versions = new Map<number, ArticleVersion>();
  readonly attachmentsByVersion = new Map<number, number[]>();

  async createVersion(input: CreateArticleVersionInput): Promise<ArticleVersion> {
    const version: ArticleVersion = {
      articleId: input.articleId,
      contentHash: input.contentHash,
      createdAt: new Date(),
      createdBy: input.createdBy,
      customRuleVersion: input.customRuleVersion ?? null,
      htmlPath: input.htmlPath ?? null,
      id: this.nextId,
      isPinned: false,
      isPublishedSnapshot: false,
      locale: input.locale,
      mdContent: input.mdContent,
      rendererVersion: input.rendererVersion ?? null,
      renderHash: input.renderHash ?? null,
      renderStatus: input.renderStatus ?? "pending",
      templateVersion: input.templateVersion ?? null,
      versionNo: input.versionNo
    };

    this.nextId += 1;
    this.versions.set(version.id, version);
    return cloneVersion(version);
  }

  async findById(id: number): Promise<ArticleVersion | null> {
    const version = this.versions.get(id);
    return version ? cloneVersion(version) : null;
  }

  async findLatestByArticleAndLocale(articleId: number, locale: ArticleVersionLocale): Promise<ArticleVersion | null> {
    const versions = await this.listByArticleAndLocale(articleId, locale);
    return versions[0] ?? null;
  }

  async listByArticleAndLocale(articleId: number, locale: ArticleVersionLocale): Promise<ArticleVersion[]> {
    return [...this.versions.values()]
      .filter((version) => version.articleId === articleId && version.locale === locale)
      .sort((left, right) => right.versionNo - left.versionNo)
      .map(cloneVersion);
  }

  async listSummariesByArticleAndLocale(articleId: number, locale: ArticleVersionLocale): Promise<ArticleVersionSummary[]> {
    return [...this.versions.values()]
      .filter((version) => version.articleId === articleId && version.locale === locale)
      .sort((left, right) => right.versionNo - left.versionNo)
      .map((version) => {
        const clonedVersion = cloneVersion(version);

        return {
          articleId: clonedVersion.articleId,
          contentHash: clonedVersion.contentHash,
          contentSizeBytes: Buffer.byteLength(clonedVersion.mdContent, "utf8"),
          createdAt: clonedVersion.createdAt,
          createdBy: clonedVersion.createdBy,
          customRuleVersion: clonedVersion.customRuleVersion,
          htmlPath: clonedVersion.htmlPath,
          id: clonedVersion.id,
          isPinned: clonedVersion.isPinned,
          isPublishedSnapshot: clonedVersion.isPublishedSnapshot,
          locale: clonedVersion.locale,
          renderHash: clonedVersion.renderHash,
          rendererVersion: clonedVersion.rendererVersion,
          renderStatus: clonedVersion.renderStatus,
          templateVersion: clonedVersion.templateVersion,
          versionNo: clonedVersion.versionNo
        };
      });
  }

  async getNextVersionNo(articleId: number, locale: ArticleVersionLocale): Promise<number> {
    const versions = await this.listByArticleAndLocale(articleId, locale);
    return (versions[0]?.versionNo ?? 0) + 1;
  }

  async updateRenderStatus(input: UpdateRenderStatusInput): Promise<ArticleVersion | null> {
    const version = this.versions.get(input.versionId);

    if (!version) {
      return null;
    }

    version.renderStatus = input.renderStatus;
    if (input.renderHash !== undefined) {
      version.renderHash = input.renderHash;
    }

    return cloneVersion(version);
  }

  async updatePublishedRenderResult(input: UpdatePublishedRenderResultInput): Promise<ArticleVersion | null> {
    const version = this.versions.get(input.versionId);

    if (!version) {
      return null;
    }

    version.customRuleVersion = input.customRuleVersion;
    version.htmlPath = input.htmlPath;
    version.isPublishedSnapshot = true;
    version.rendererVersion = input.rendererVersion;
    version.renderHash = input.renderHash;
    version.renderStatus = "success";
    version.templateVersion = input.templateVersion;
    return cloneVersion(version);
  }

  async replaceVersionAttachments(input: ReplaceVersionAttachmentsInput): Promise<void> {
    this.attachmentsByVersion.set(input.versionId, [...input.attachmentIds]);
  }
}

class EmptyAttachmentResolver {
  async validateAttachmentReferences(): Promise<number[]> {
    return [];
  }
}

class FakeTotpService {
  async isTotpEnabled(): Promise<boolean> {
    return false;
  }
}

class FakePermissionService {
  async roleExists(roleKey: string): Promise<boolean> {
    return ["admin", "ssvip", "svip", "guest"].includes(roleKey);
  }

  async getPermissionsForRole(roleKey: string): Promise<string[]> {
    if (roleKey === "admin") {
      return ["article:create", "article:update", "article:publish", "article:delete", "attachment:upload", "user:manage", "system:maintain"];
    }

    if (roleKey === "editor") {
      return ["article:create", "article:update", "article:publish", "attachment:upload"];
    }

    return [];
  }
}

class FakeMarkdownRenderer {
  async render(): Promise<RenderedHtml> {
    return {
      customRuleVersion: "rules-test",
      html: "<!doctype html><html><body><main>new html</main></body></html>",
      rendererVersion: "renderer-test",
      renderHash: "render-hash-test",
      templateVersion: "template-test",
      usedAttachments: []
    };
  }
}

class FailingStaticPublisher {
  async publishArticleHtml(): Promise<never> {
    throw new Error("simulated html write failure");
  }
}

class MemoryStaticPublisher {
  async publishArticleHtml(input: { articleId: number; locale: ArticleLocale; versionId: number }) {
    const htmlPath = `${input.locale}/articles/${input.articleId}/${input.versionId}/index.html`;

    return {
      absolutePath: path.join(tempRoot, "rendered", htmlPath),
      htmlPath
    };
  }
}

class FakeSeoService {
  async buildArticleMetaFromTranslation(translation: ArticleTranslation) {
    return {
      alternates: [],
      canonicalUrl: `https://example.test/${translation.locale}/posts/${translation.slug}`,
      description: translation.seoDescription,
      title: translation.seoTitle ?? translation.title
    };
  }
}

class TestState {
  readonly articleRepository = new MemoryArticleRepository();
  readonly translationRepository = new MemoryTranslationRepository(this.articleRepository);
  readonly userRepository = new MemoryUserRepository();
  readonly versionRepository = new MemoryVersionRepository();
}

async function createServices(state: TestState) {
  const modules = await modulesPromise;
  const userService = new modules.UserService(state.userRepository as never, new FakePermissionService() as never);
  const setupService = new modules.SetupService(userService);
  const jwtService = new modules.JwtService();
  const authService = new modules.AuthService(
    state.userRepository as never,
    jwtService,
    new FakeTotpService() as never,
    new FakePermissionService() as never
  );
  const articleService = new modules.ArticleService(
    state.articleRepository as never,
    state.translationRepository as never,
    new FakePermissionService() as never
  );
  const versionService = new modules.ArticleVersionService(
    state.articleRepository as never,
    state.translationRepository as never,
    state.versionRepository as never,
    new EmptyAttachmentResolver() as never
  );
  const publishService = new modules.PublishService(
    state.versionRepository as never,
    state.translationRepository as never,
    new FakeMarkdownRenderer() as never,
    new FailingStaticPublisher() as never,
    new FakeSeoService() as never,
    new FakePermissionService() as never
  );

  return {
    articleService,
    authService,
    publishService,
    setupService,
    versionService
  };
}

async function prepareSetupToken(): Promise<void> {
  await writeFile(path.join(tempRoot, "runtime", "setup-token"), setupToken, "utf8");
}

function assertAppError(error: unknown, code: string, statusCode: number): void {
  assert.ok(error instanceof AppError);
  assert.equal(error.code, code);
  assert.equal(error.statusCode, statusCode);
}

before(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "liax-test-"));
  await Promise.all([
    mkdir(path.join(tempRoot, "runtime"), { recursive: true }),
    mkdir(path.join(tempRoot, "rendered"), { recursive: true }),
    mkdir(path.join(tempRoot, "uploads"), { recursive: true })
  ]);
  setTestEnvironment(tempRoot);
  modulesPromise = loadModules();
});

after(async () => {
  if (tempRoot) {
    await rm(tempRoot, { force: true, recursive: true });
  }
});

describe("admin article integration flow", () => {
  it("initializes admin and logs in with valid credentials", async () => {
    const state = new TestState();
    const services = await createServices(state);

    await prepareSetupToken();
    const admin = await services.setupService.initializeAdmin({
      email: "Admin@Example.test",
      password: "correct-password",
      setupToken,
      username: "admin"
    });
    const deletedToken = await readFile(path.join(tempRoot, "runtime", "setup-token"), "utf8").catch(() => null);
    const login = await services.authService.login({
      email: "admin@example.test",
      password: "correct-password"
    });

    assert.equal(admin.role, "admin");
    assert.equal(admin.email, "admin@example.test");
    assert.equal(deletedToken, null);
    assert.equal(login.totpRequired, false);
    assert.equal(login.user.id, admin.id);
    assert.equal(typeof login.token, "string");
    assert.ok(login.token.length > 20);
  });

  it("logs in with a username identifier", async () => {
    const state = new TestState();
    const services = await createServices(state);

    await prepareSetupToken();
    const admin = await services.setupService.initializeAdmin({
      email: "admin@example.test",
      password: "correct-password",
      setupToken,
      username: "rexyleria"
    });
    const login = await services.authService.login({
      email: "rexyleria",
      password: "correct-password"
    });

    assert.equal(login.totpRequired, false);
    assert.equal(login.user.id, admin.id);
    assert.equal(login.user.username, "rexyleria");
  });

  it("rejects login with invalid credentials", async () => {
    const state = new TestState();
    const services = await createServices(state);

    await prepareSetupToken();
    await services.setupService.initializeAdmin({
      email: "admin@example.test",
      password: "correct-password",
      setupToken,
      username: "admin"
    });

    await assert.rejects(
      () => services.authService.login({ email: "admin@example.test", password: "wrong-password" }),
      (error) => {
        assertAppError(error, errorCodes.unauthorized, 401);
        return true;
      }
    );
  });

  it("creates article, translations, and independent zh-CN/en-US markdown versions", async () => {
    const state = new TestState();
    const services = await createServices(state);

    await prepareSetupToken();
    const admin = await services.setupService.initializeAdmin({
      email: "admin@example.test",
      password: "correct-password",
      setupToken,
      username: "admin"
    });
    const article = await services.articleService.createArticle(admin.id, {});
    const zhTranslation = await services.articleService.createTranslation(article.id, {
      locale: "zh-CN",
      slug: "ni-hao",
      title: "你好"
    });
    const enTranslation = await services.articleService.createTranslation(article.id, {
      locale: "en-US",
      slug: "hello",
      title: "Hello"
    });
    const zhVersion = await services.versionService.saveVersion({
      articleId: article.id,
      baseVersionId: null,
      createdBy: admin.id,
      locale: "zh-CN",
      mdContent: "# 你好\n"
    });
    const enVersion = await services.versionService.saveVersion({
      articleId: article.id,
      baseVersionId: null,
      createdBy: admin.id,
      locale: "en-US",
      mdContent: "# Hello\n"
    });
    const zhCurrent = await state.translationRepository.findByArticleAndLocale(article.id, "zh-CN");
    const enCurrent = await state.translationRepository.findByArticleAndLocale(article.id, "en-US");
    const autoSlugArticle = await services.articleService.createArticle(admin.id, {});
    const autoSlugTranslation = await services.articleService.createTranslation(autoSlugArticle.id, {
      locale: "zh-CN",
      slug: "",
      title: "自动 slug"
    });

    assert.equal(article.status, "draft");
    assert.equal(zhTranslation.locale, "zh-CN");
    assert.equal(enTranslation.locale, "en-US");
    assert.match(autoSlugTranslation.slug, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    assert.equal(zhVersion.unchanged, false);
    assert.equal(enVersion.unchanged, false);
    assert.equal(zhVersion.version.versionNo, 1);
    assert.equal(enVersion.version.versionNo, 1);
    assert.equal(zhCurrent?.currentVersionId, zhVersion.version.id);
    assert.equal(enCurrent?.currentVersionId, enVersion.version.id);
  });

  it("does not create a new version for unchanged markdown and reports baseVersionId conflicts", async () => {
    const state = new TestState();
    const services = await createServices(state);

    await prepareSetupToken();
    const admin = await services.setupService.initializeAdmin({
      email: "admin@example.test",
      password: "correct-password",
      setupToken,
      username: "admin"
    });
    const article = await services.articleService.createArticle(admin.id, {});
    await services.articleService.createTranslation(article.id, {
      locale: "zh-CN",
      slug: "same-content",
      title: "相同内容"
    });
    const firstSave = await services.versionService.saveVersion({
      articleId: article.id,
      baseVersionId: null,
      createdBy: admin.id,
      locale: "zh-CN",
      mdContent: "# 相同内容\n"
    });
    const unchangedSave = await services.versionService.saveVersion({
      articleId: article.id,
      baseVersionId: firstSave.version.id,
      createdBy: admin.id,
      locale: "zh-CN",
      mdContent: "# 相同内容"
    });
    const versions = await services.versionService.listVersions(article.id, "zh-CN");

    assert.equal(unchangedSave.unchanged, true);
    assert.equal(unchangedSave.version.id, firstSave.version.id);
    assert.equal(versions.length, 1);

    await assert.rejects(
      () => services.versionService.saveVersion({
        articleId: article.id,
        baseVersionId: null,
        createdBy: admin.id,
        locale: "zh-CN",
        mdContent: "# 新内容"
      }),
      (error) => {
        assertAppError(error, errorCodes.articleVersionConflict, 409);
        return true;
      }
    );
  });

  it("imports a 12MB markdown file as a version and lists it without loading the body", async () => {
    const state = new TestState();
    const services = await createServices(state);

    await prepareSetupToken();
    const admin = await services.setupService.initializeAdmin({
      email: "admin@example.test",
      password: "correct-password",
      setupToken,
      username: "admin"
    });
    const article = await services.articleService.createArticle(admin.id, {});
    await services.articleService.createTranslation(article.id, {
      locale: "zh-CN",
      slug: "large-import",
      title: "大文件导入"
    });

    const largeMarkdown = `# Large Import\n\n${"A long paragraph for server import.\n\n".repeat(Math.ceil((12 * 1024 * 1024) / 37))}`;
    const result = await services.versionService.importMarkdownVersion({
      articleId: article.id,
      createdBy: admin.id,
      locale: "zh-CN",
      mdContent: largeMarkdown
    });
    const summaries = await services.versionService.listVersionSummaries(article.id, "zh-CN");

    assert.equal(result.unchanged, false);
    assert.equal(result.version.versionNo, 1);
    assert.equal(result.version.mdContent, largeMarkdown.replace(/\r\n/g, "\n").trimEnd());
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].id, result.version.id);
    assert.equal(summaries[0].contentSizeBytes, Buffer.byteLength(result.version.mdContent, "utf8"));
    assert.equal(Object.hasOwn(summaries[0], "mdContent"), false);
  });

  it("keeps the existing published HTML pointer when publish fails", async () => {
    const state = new TestState();
    const services = await createServices(state);

    await prepareSetupToken();
    const admin = await services.setupService.initializeAdmin({
      email: "admin@example.test",
      password: "correct-password",
      setupToken,
      username: "admin"
    });
    const article = await services.articleService.createArticle(admin.id, {});
    await services.articleService.createTranslation(article.id, {
      locale: "zh-CN",
      slug: "publish-failure",
      title: "发布失败"
    });
    const oldVersion = await services.versionService.saveVersion({
      articleId: article.id,
      baseVersionId: null,
      createdBy: admin.id,
      locale: "zh-CN",
      mdContent: "# 旧版本"
    });
    const oldHtmlRelativePath = `zh-CN/articles/${article.id}/${oldVersion.version.id}/index.html`;
    const oldHtmlAbsolutePath = path.join(tempRoot, "rendered", oldHtmlRelativePath);
    const oldHtml = "<!doctype html><html><body><main>old html</main></body></html>";

    await mkdir(path.dirname(oldHtmlAbsolutePath), { recursive: true });
    await writeFile(oldHtmlAbsolutePath, oldHtml, "utf8");
    await state.translationRepository.updatePublishedVersion({
      articleId: article.id,
      currentHtmlPath: oldHtmlRelativePath,
      locale: "zh-CN",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedVersionId: oldVersion.version.id
    });
    const newVersion = await services.versionService.saveVersion({
      articleId: article.id,
      baseVersionId: oldVersion.version.id,
      createdBy: admin.id,
      locale: "zh-CN",
      mdContent: "# 新版本"
    });

    await assert.rejects(() => services.publishService.publishArticle({
      articleId: article.id,
      locale: "zh-CN",
      versionId: newVersion.version.id
    }));

    const translationAfterFailure = await state.translationRepository.findByArticleAndLocale(article.id, "zh-CN");
    const failedVersion = await state.versionRepository.findById(newVersion.version.id);
    const oldHtmlAfterFailure = await readFile(oldHtmlAbsolutePath, "utf8");

    assert.equal(translationAfterFailure?.publishedVersionId, oldVersion.version.id);
    assert.equal(translationAfterFailure?.currentHtmlPath, oldHtmlRelativePath);
    assert.equal(failedVersion?.renderStatus, "failed");
    assert.equal(oldHtmlAfterFailure, oldHtml);
  });

  it("preserves configured article visibility when publishing without a role payload", async () => {
    const state = new TestState();
    const services = await createServices(state);
    const modules = await modulesPromise;

    await prepareSetupToken();
    const admin = await services.setupService.initializeAdmin({
      email: "admin@example.test",
      password: "correct-password",
      setupToken,
      username: "admin"
    });
    const article = await services.articleService.createArticle(admin.id, {});
    await services.articleService.createTranslation(article.id, {
      allowedRoles: ["admin"],
      locale: "zh-CN",
      slug: "restricted-publish",
      title: "权限发布"
    });
    const version = await services.versionService.saveVersion({
      articleId: article.id,
      baseVersionId: null,
      createdBy: admin.id,
      locale: "zh-CN",
      mdContent: "# Restricted"
    });
    const publishService = new modules.PublishService(
      state.versionRepository as never,
      state.translationRepository as never,
      new FakeMarkdownRenderer() as never,
      new MemoryStaticPublisher() as never,
      new FakeSeoService() as never,
      new FakePermissionService() as never
    );

    const result = await publishService.publishArticle({
      articleId: article.id,
      locale: "zh-CN",
      versionId: version.version.id
    });

    assert.deepEqual(result.translation.allowedRoles, ["admin"]);
  });

  it("does not fallback public articles to another locale", async () => {
    const modules = await modulesPromise;
    const translationRepository = {
      async findByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<ArticleTranslation | null> {
        if (locale !== "zh-CN" || slug !== "hello") {
          return null;
        }

        return {
          articleId: 1,
          allowedRoles: [],
          createdAt: new Date(),
          currentHtmlPath: "zh-CN/articles/1/1/index.html",
          currentVersionId: 1,
          id: 1,
          locale,
          publishedAt: new Date(),
          publishedVersionId: 1,
          seoDescription: null,
          seoTitle: null,
          slug,
          summary: null,
          title: "你好",
          updatedAt: new Date()
        };
      },
      async findPublicByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<ArticleTranslation | null> {
        return this.findByLocaleAndSlug(locale, slug);
      }
    };
    const controller = new modules.PublicArticleController(translationRepository as never);
    const request = {
      params: {
        localePrefix: "en",
        slug: "hello"
      }
    };
    let html = "";
    let statusCode = 0;
    let type = "";
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      type(value: string) {
        type = value;
        return this;
      },
      send(value: string) {
        html = value;
        return this;
      }
    };

    await controller.getArticle(request as never, response as never);

    assert.equal(statusCode, 404);
    assert.equal(type, "html");
    assert.match(html, /Page not found/);
    assert.match(html, /does not automatically fall back to another language/);
    assert.doesNotMatch(html, /你好/);
  });

  it("does not expose published translations for soft-deleted articles", async () => {
    const modules = await modulesPromise;
    const state = new TestState();
    const services = await createServices(state);

    await prepareSetupToken();
    const admin = await services.setupService.initializeAdmin({
      email: "admin@example.test",
      password: "correct-password",
      setupToken,
      username: "admin"
    });
    const article = await services.articleService.createArticle(admin.id, {});
    await services.articleService.createTranslation(article.id, {
      locale: "en-US",
      slug: "deleted-post",
      title: "Deleted Post"
    });
    const version = await services.versionService.saveVersion({
      articleId: article.id,
      baseVersionId: null,
      createdBy: admin.id,
      locale: "en-US",
      mdContent: "# Deleted"
    });

    await state.translationRepository.updatePublishedVersion({
      articleId: article.id,
      currentHtmlPath: `en-US/articles/${article.id}/${version.version.id}/index.html`,
      locale: "en-US",
      publishedAt: new Date(),
      publishedVersionId: version.version.id
    });
    await services.articleService.softDeleteArticle(article.id);

    const controller = new modules.PublicArticleController(state.translationRepository as never);
    const request = {
      headers: {},
      params: {
        localePrefix: "en",
        slug: "deleted-post"
      }
    };
    let html = "";
    let statusCode = 0;
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      type() {
        return this;
      },
      send(value: string) {
        html = value;
        return this;
      }
    };

    await controller.getArticle(request as never, response as never);

    assert.equal(statusCode, 404);
    assert.match(html, /Page not found/);
    assert.equal(await state.translationRepository.findPublicByLocaleAndSlug("en-US", "deleted-post"), null);
  });

  it("protects published articles when publish visibility is limited to selected roles", async () => {
    const modules = await modulesPromise;
    const restrictedHtmlPath = path.join(tempRoot, "rendered", "en-US/articles/9/99/index.html");
    const translationRepository = {
      async findByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<ArticleTranslation | null> {
        if (locale !== "en-US" || slug !== "restricted") {
          return null;
        }

        return {
          allowedRoles: ["admin"],
          articleId: 9,
          createdAt: new Date(),
          currentHtmlPath: "en-US/articles/9/99/index.html",
          currentVersionId: 99,
          id: 99,
          locale,
          publishedAt: new Date(),
          publishedVersionId: 99,
          seoDescription: null,
          seoTitle: null,
          slug,
          summary: null,
          title: "Restricted",
          updatedAt: new Date()
        };
      },
      async findPublicByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<ArticleTranslation | null> {
        return this.findByLocaleAndSlug(locale, slug);
      }
    };
    const jwtService = {
      verifyToken() {
        return {
          exp: 9999999999,
          iat: 1,
          purpose: "session",
          role: "admin",
          userId: 1
        };
      }
    };
    const controller = new modules.PublicArticleController(
      translationRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      jwtService as never
    );

    await mkdir(path.dirname(restrictedHtmlPath), { recursive: true });
    await writeFile(restrictedHtmlPath, "<!doctype html><html><body>restricted secret</body></html>", "utf8");

    const restrictedRequest = {
      headers: {},
      params: {
        localePrefix: "en",
        slug: "restricted"
      }
    };
    const allowedRequest = {
      headers: {
        authorization: "Bearer valid-admin-token"
      },
      params: {
        localePrefix: "en",
        slug: "restricted"
      }
    };
    const response = {
      body: "",
      statusCode: 0,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      type() {
        return this;
      },
      send(value: string) {
        this.body = value;
        return this;
      }
    };

    await controller.getArticle(restrictedRequest as never, response as never);
    assert.equal(response.statusCode, 403);
    assert.doesNotMatch(response.body, /restricted secret/);

    response.body = "";
    response.statusCode = 0;

    await controller.getArticle(allowedRequest as never, response as never);
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /restricted secret/);
  });
});

describe("admin user management integration flow", () => {
  it("creates users through the admin controller without returning or auditing password data", async () => {
    const state = new TestState();
    const modules = await modulesPromise;
    const userService = new modules.UserService(state.userRepository as never, new FakePermissionService() as never);
    const admin = await state.userRepository.createUser({
      email: "admin@example.test",
      passwordHash: "hash",
      role: "admin",
      username: "admin"
    });
    const auditEntries: unknown[] = [];
    const controller = new modules.UserController(userService, {
      async recordFromRequest(input: unknown): Promise<void> {
        auditEntries.push(input);
      }
    } as never);
    const response = {
      body: null as unknown,
      statusCode: 0,
      json(body: unknown) {
        this.body = body;
        return this;
      },
      status(statusCode: number) {
        this.statusCode = statusCode;
        return this;
      }
    };

    await controller.createUser({
      auth: { userId: admin.id },
      body: {
        email: "ssvip@example.test",
        password: "initial-password",
        role: "ssvip",
        username: "ssvip"
      }
    } as never, response as never);

    const createdUserRecord = await state.userRepository.findByEmail("ssvip@example.test");
    const responseBody = response.body as { user: Record<string, unknown> };
    const auditEntry = auditEntries[0] as { metadata: Record<string, unknown> };

    assert.equal(response.statusCode, 201);
    assert.equal(responseBody.user.email, "ssvip@example.test");
    assert.equal(responseBody.user.role, "ssvip");
    assert.equal(responseBody.user.passwordHash, undefined);
    assert.match(createdUserRecord?.passwordHash ?? "", /^scrypt\$/);
    assert.notEqual(createdUserRecord?.passwordHash, "initial-password");
    assert.deepEqual(auditEntry.metadata, { role: "ssvip" });
  });

  it("rejects assigning the Guest identity to console users", async () => {
    const state = new TestState();
    const modules = await modulesPromise;
    const userService = new modules.UserService(state.userRepository as never, new FakePermissionService() as never);

    await assert.rejects(
      () => userService.createUser({
        email: "guest@example.test",
        passwordHash: "hash",
        role: "guest",
        username: "guest"
      }),
      (error) => {
        assertAppError(error, errorCodes.validationFailed, 400);
        return true;
      }
    );
  });

  it("lists users and batch updates roles without changing the acting admin", async () => {
    const state = new TestState();
    const modules = await modulesPromise;
    const userService = new modules.UserService(state.userRepository as never, new FakePermissionService() as never);
    const admin = await state.userRepository.createUser({
      email: "admin@example.test",
      passwordHash: "hash",
      role: "admin",
      username: "admin"
    });
    const ssvip = await state.userRepository.createUser({
      email: "ssvip@example.test",
      passwordHash: "hash",
      role: "svip",
      username: "ssvip"
    });
    const svip = await state.userRepository.createUser({
      email: "svip@example.test",
      passwordHash: "hash",
      role: "svip",
      username: "svip"
    });
    const searchResults = await userService.listUsers({ search: "example" });
    const result = await userService.updateManyRoles([admin.id, ssvip.id, svip.id], "ssvip", admin.id);
    const adminAfterUpdate = await state.userRepository.findById(admin.id);
    const ssvipAfterUpdate = await state.userRepository.findById(ssvip.id);
    const svipAfterUpdate = await state.userRepository.findById(svip.id);

    assert.equal(searchResults.length, 3);
    assert.equal(result.updated, 2);
    assert.equal(adminAfterUpdate?.role, "admin");
    assert.equal(ssvipAfterUpdate?.role, "ssvip");
    assert.equal(svipAfterUpdate?.role, "ssvip");
  });

  it("batch soft deletes users without disabling the acting admin", async () => {
    const state = new TestState();
    const modules = await modulesPromise;
    const userService = new modules.UserService(state.userRepository as never, new FakePermissionService() as never);
    const admin = await state.userRepository.createUser({
      email: "admin@example.test",
      passwordHash: "hash",
      role: "admin",
      username: "admin"
    });
    const user = await state.userRepository.createUser({
      email: "user@example.test",
      passwordHash: "hash",
      role: "svip",
      username: "user"
    });
    const result = await userService.deleteManyUsers([admin.id, user.id], admin.id);
    const adminAfterDelete = await state.userRepository.findById(admin.id);
    const userAfterDelete = await state.userRepository.findById(user.id);

    assert.equal(result.deleted, 1);
    assert.equal(adminAfterDelete?.disabledAt, null);
    assert.ok(userAfterDelete?.disabledAt instanceof Date);
  });
});

describe("admin attachment management integration flow", () => {
  it("lists unused attachments and only soft deletes unreferenced attachments", async () => {
    const modules = await modulesPromise;
    const attachmentRepository = new MemoryAttachmentRepository();
    const attachmentService = new modules.AttachmentService(attachmentRepository as never);
    const unusedAttachment = await attachmentRepository.createAttachment({
      mimeType: "image/png",
      originalFilename: "unused.png",
      ownerId: 1,
      publicUrl: "/uploads/unused.png",
      sha256: "unused",
      sizeBytes: 9,
      storageKey: "uploads/unused.png",
      used: false
    });
    const usedAttachment = await attachmentRepository.createAttachment({
      mimeType: "image/png",
      originalFilename: "used.png",
      ownerId: 1,
      publicUrl: "/uploads/used.png",
      sha256: "used",
      sizeBytes: 9,
      storageKey: "uploads/used.png",
      used: true
    });
    const unusedBeforeDelete = await attachmentService.listAttachments({ unusedOnly: true });
    const deleteResult = await attachmentService.softDeleteUnusedAttachments([unusedAttachment.id, usedAttachment.id]);
    const unusedAfterDelete = await attachmentRepository.attachments.get(unusedAttachment.id);
    const usedAfterDelete = await attachmentRepository.attachments.get(usedAttachment.id);
    const unusedAfterList = await attachmentService.listAttachments({ unusedOnly: true });

    assert.deepEqual(unusedBeforeDelete.map((attachment) => attachment.id), [unusedAttachment.id]);
    assert.equal(deleteResult.deleted, 1);
    assert.ok(unusedAfterDelete?.deletedAt instanceof Date);
    assert.equal(usedAfterDelete?.deletedAt, null);
    assert.deepEqual(unusedAfterList.map((attachment) => attachment.id), []);
  });
});
