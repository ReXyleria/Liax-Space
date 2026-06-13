import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { PublicArticleController } from "./PublicArticleController.js";

const publicArticleController = new PublicArticleController();

export const publicRoutes = Router();

type PublicLocalePrefix = "zh" | "en";
type LegacyPublicLocalePrefix = "zh-CN" | "en-US";

const legacyPublicLocalePrefixMap: Record<LegacyPublicLocalePrefix, PublicLocalePrefix> = {
  "en-US": "en",
  "zh-CN": "zh"
};

const legacySectionMap: Record<string, string> = {
  articles: "posts",
  archives: "archives",
  guestbook: "guestbook",
  moments: "moments",
  posts: "posts",
  search: "search",
  tags: "tags"
};

export function isPublicLocalePrefix(value: string | undefined): value is PublicLocalePrefix {
  return value === "zh" || value === "en";
}

export function resolvePublicLocalePrefix(value: string | undefined): PublicLocalePrefix | null {
  if (isPublicLocalePrefix(value)) {
    return value;
  }

  return value === "zh-CN" || value === "en-US" ? legacyPublicLocalePrefixMap[value] : null;
}

export function mapLegacyPublicSection(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return legacySectionMap[value] ?? null;
}

function requirePublicLocalePrefix(request: Request, _response: Response, next: NextFunction): void {
  if (!isPublicLocalePrefix(request.params.localePrefix)) {
    next("route");
    return;
  }

  next();
}

function querySuffix(request: Request): string {
  const queryIndex = request.originalUrl.indexOf("?");
  return queryIndex >= 0 ? request.originalUrl.slice(queryIndex) : "";
}

function redirectLegacyHome(request: Request, response: Response, next: NextFunction): void {
  const prefix = resolvePublicLocalePrefix(request.params.localePrefix);

  if (!prefix || isPublicLocalePrefix(request.params.localePrefix)) {
    next("route");
    return;
  }

  response.redirect(302, `/${prefix}${querySuffix(request)}`);
}

function redirectLegacyArticle(request: Request, response: Response, next: NextFunction): void {
  const prefix = resolvePublicLocalePrefix(request.params.localePrefix);

  if (!prefix || isPublicLocalePrefix(request.params.localePrefix)) {
    next("route");
    return;
  }

  response.redirect(302, `/${prefix}/posts/${encodeURIComponent(request.params.slug)}${querySuffix(request)}`);
}

function redirectLegacyTagDetail(request: Request, response: Response, next: NextFunction): void {
  const prefix = resolvePublicLocalePrefix(request.params.localePrefix);

  if (!prefix || isPublicLocalePrefix(request.params.localePrefix)) {
    next("route");
    return;
  }

  response.redirect(302, `/${prefix}/tags/${encodeURIComponent(request.params.slug)}${querySuffix(request)}`);
}

function redirectLegacySection(request: Request, response: Response, next: NextFunction): void {
  const prefix = resolvePublicLocalePrefix(request.params.localePrefix);
  const section = mapLegacyPublicSection(request.params.section);

  if (!prefix || !section || isPublicLocalePrefix(request.params.localePrefix)) {
    next("route");
    return;
  }

  response.redirect(302, `/${prefix}/${section}${querySuffix(request)}`);
}

publicRoutes.get("/:localePrefix", redirectLegacyHome);
publicRoutes.get("/:localePrefix/articles/:slug", redirectLegacyArticle);
publicRoutes.get("/:localePrefix/tags/:slug", redirectLegacyTagDetail);
publicRoutes.get("/:localePrefix/:section", redirectLegacySection);
publicRoutes.get("/:localePrefix", requirePublicLocalePrefix, asyncHandler(publicArticleController.getHome));
publicRoutes.get("/:localePrefix/posts/:slug", requirePublicLocalePrefix, asyncHandler(publicArticleController.getArticle));
publicRoutes.get("/:localePrefix/tags/:slug", requirePublicLocalePrefix, asyncHandler(publicArticleController.getTagDetail));
publicRoutes.post("/:localePrefix/guestbook", requirePublicLocalePrefix, asyncHandler(publicArticleController.postGuestbook));
publicRoutes.get("/:localePrefix/:section", requirePublicLocalePrefix, asyncHandler(publicArticleController.getSection));
