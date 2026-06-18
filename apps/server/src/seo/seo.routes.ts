import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { RssService } from "./RssService.js";
import { SeoPushService, type SeoPushSubmitResult } from "./SeoPushService.js";
import type { SeoPushSubmission } from "./SeoPushRepository.js";
import { SitemapService } from "./SitemapService.js";
import { publicPrefixToLocale } from "./SeoService.js";

const sitemapService = new SitemapService();
const rssService = new RssService();
const seoPushService = new SeoPushService();

export const seoRoutes = Router();

function serializeSeoPushSubmission(submission: SeoPushSubmission) {
  return {
    createdAt: submission.createdAt.toISOString(),
    id: submission.id,
    message: submission.message,
    provider: submission.provider,
    requestUrl: submission.requestUrl,
    status: submission.status,
    statusCode: submission.statusCode,
    submittedCount: submission.submittedCount,
    urls: submission.urls
  };
}

function serializeSeoPushSubmitResult(result: SeoPushSubmitResult) {
  return {
    submissions: result.submissions.map(serializeSeoPushSubmission)
  };
}

seoRoutes.get(
  "/sitemap.xml",
  asyncHandler(async (_request, response) => {
    response.status(200).type("application/xml").send(sitemapService.renderSitemapIndex());
  })
);

seoRoutes.get(
  "/zh/sitemap.xml",
  asyncHandler(async (_request, response) => {
    response.status(200).type("application/xml").send(await sitemapService.renderLocaleSitemap(publicPrefixToLocale("zh")));
  })
);

seoRoutes.get(
  "/en/sitemap.xml",
  asyncHandler(async (_request, response) => {
    response.status(200).type("application/xml").send(await sitemapService.renderLocaleSitemap(publicPrefixToLocale("en")));
  })
);

seoRoutes.get(
  "/zh/rss.xml",
  asyncHandler(async (_request, response) => {
    response.status(200).type("application/rss+xml").send(await rssService.renderFeed(publicPrefixToLocale("zh")));
  })
);

seoRoutes.get(
  "/en/rss.xml",
  asyncHandler(async (_request, response) => {
    response.status(200).type("application/rss+xml").send(await rssService.renderFeed(publicPrefixToLocale("en")));
  })
);

seoRoutes.get(
  "/admin/seo/push/submissions",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (_request, response) => {
    response.status(200).json({
      submissions: (await seoPushService.listRecentSubmissions()).map(serializeSeoPushSubmission)
    });
  })
);

seoRoutes.post(
  "/admin/seo/push/submit",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (request, response) => {
    response.status(200).json(serializeSeoPushSubmitResult(await seoPushService.submit({
      providers: request.body?.providers,
      urls: request.body?.urls
    })));
  })
);
