import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { articleRoutes } from "./articles/articles.routes.js";
import { attachmentRoutes } from "./attachments/attachments.routes.js";
import { auditRoutes } from "./audit/audit.routes.js";
import { authRoutes } from "./auth/auth.routes.js";
import { categoryRoutes } from "./categories/categories.routes.js";
import { AppError } from "./common/AppError.js";
import { asyncHandler } from "./common/asyncHandler.js";
import { errorCodes } from "./common/errorCodes.js";
import { errorHandler } from "./common/errorHandler.js";
import { requestIdMiddleware } from "./common/requestId.js";
import { env } from "./config/env.js";
import { storagePaths } from "./config/paths.js";
import { checkDatabaseHealth } from "./database/health.js";
import { momentRoutes } from "./moments/moments.routes.js";
import { permissionsRoutes } from "./permissions/permissions.routes.js";
import { publisherRoutes } from "./publisher/publisher.routes.js";
import { publicRoutes } from "./public-site/public.routes.js";
import { renderRoutes } from "./renderer/render.routes.js";
import { searchRoutes } from "./search/search.routes.js";
import { seoRoutes } from "./seo/seo.routes.js";
import { settingsRoutes } from "./settings/settings.routes.js";
import { setupRoutes } from "./setup/setup.routes.js";
import { tagRoutes } from "./tags/tags.routes.js";
import { translationRoutes } from "./translation/translation.routes.js";
import { userRoutes } from "./users/users.routes.js";
import { versionRoutes } from "./versions/versions.routes.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const adminDistDir = resolve(projectRoot, "apps", "admin", "dist");
const adminIndexHtml = resolve(adminDistDir, "index.html");
const adminAssetsDir = resolve(adminDistDir, "assets");
const defaultJsonBodyLimit = "64kb";
const articleVersionJsonBodyLimit = "24mb";

function mountAdminStatic(app: express.Express): void {
  if (!existsSync(adminIndexHtml)) {
    return;
  }

  if (existsSync(adminAssetsDir)) {
    app.use("/assets", express.static(adminAssetsDir, {
      dotfiles: "deny",
      fallthrough: false,
      index: false,
      immutable: true,
      maxAge: "1y"
    }));
  }

  app.get(["/console", "/console/*"], (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.sendFile(adminIndexHtml);
  });
}

function createApiNotFoundError(): AppError {
  return new AppError("API route not found.", {
    code: errorCodes.notFound,
    statusCode: 404
  });
}

export function createApp() {
  const app = express();
  const localAdminOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.get("/", (_request, response) => {
    response.redirect(302, "/zh");
  });
  app.get("/favicon.ico", (_request, response) => {
    response.status(204).end();
  });
  app.get("/favicon.svg", (_request, response) => {
    response
      .type("image/svg+xml")
      .setHeader("Cache-Control", "public, max-age=604800");
    response.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#141413"/><text x="32" y="39" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#faf9f5">LS</text></svg>`);
  });
  app.use((request, response, next) => {
    const origin = request.headers.origin;

    if ((env.appEnv === "development" || env.appEnv === "test") && origin && localAdminOrigins.has(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, x-request-id");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      response.setHeader("Access-Control-Expose-Headers", "x-request-id");
      response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }

    next();
  });
  app.use("/uploads", express.static(storagePaths.uploadsDir, {
    dotfiles: "deny",
    fallthrough: false,
    index: false
  }));
  app.use("/admin/articles/:articleId/:locale/versions", express.json({ limit: articleVersionJsonBodyLimit }));
  app.use(express.json({ limit: defaultJsonBodyLimit }));
  app.use("/setup", setupRoutes);
  app.use("/auth", authRoutes);
  app.use(searchRoutes);
  app.use("/admin", settingsRoutes);
  app.use("/admin", articleRoutes);
  app.use("/admin", auditRoutes);
  app.use("/admin", tagRoutes);
  app.use("/admin", categoryRoutes);
  app.use("/admin", momentRoutes);
  app.use("/admin", permissionsRoutes);
  app.use("/admin", userRoutes);
  app.use("/admin", versionRoutes);
  app.use("/admin", renderRoutes);
  app.use("/admin", publisherRoutes);
  app.use("/admin", attachmentRoutes);
  app.use("/admin", translationRoutes);
  app.use(seoRoutes);
  mountAdminStatic(app);

  app.get("/health", asyncHandler(async (request, response) => {
    const database = await checkDatabaseHealth();
    const status = database.status === "ok" ? "ok" : "degraded";

    response.status(status === "ok" ? 200 : 503).json({
      status,
      time: new Date().toISOString(),
      requestId: request.requestId,
      database
    });
  }));

  app.use(["/admin", "/admin/*", "/auth", "/auth/*", "/setup", "/setup/*"], (_request, _response, next) => {
    next(createApiNotFoundError());
  });

  app.use(publicRoutes);

  app.use(errorHandler);

  return app;
}
