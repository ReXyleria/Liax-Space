import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { RssService } from "./RssService.js";
import { SitemapService } from "./SitemapService.js";
import { publicPrefixToLocale } from "./SeoService.js";

const sitemapService = new SitemapService();
const rssService = new RssService();

export const seoRoutes = Router();

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
