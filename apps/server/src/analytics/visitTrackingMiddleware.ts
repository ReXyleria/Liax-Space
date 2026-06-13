import { createHash } from "node:crypto";
import type { RequestHandler } from "express";

import { VisitRepository } from "./VisitRepository.js";

const maxHeaderLength = 512;

function firstHeaderValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncate(value: string | null, maxLength = maxHeaderLength): string | null {
  return value ? value.slice(0, maxLength) : null;
}

function readLocale(path: string): string | null {
  if (path === "/zh" || path.startsWith("/zh/") || path === "/zh-CN" || path.startsWith("/zh-CN/")) {
    return "zh-CN";
  }

  if (path === "/en" || path.startsWith("/en/") || path === "/en-US" || path.startsWith("/en-US/")) {
    return "en-US";
  }

  return null;
}

function readCountry(headers: Record<string, unknown>): string {
  const country = firstHeaderValue(headers["cf-ipcountry"])
    ?? firstHeaderValue(headers["x-vercel-ip-country"])
    ?? firstHeaderValue(headers["cloudfront-viewer-country-name"])
    ?? firstHeaderValue(headers["x-country"]);

  return country ? country.slice(0, 80) : "Unknown";
}

function readClientIp(request: Parameters<RequestHandler>[0]): string | null {
  const forwardedFor = firstHeaderValue(request.headers["x-forwarded-for"]);
  const ip = forwardedFor?.split(",")[0]?.trim() || request.ip || request.socket.remoteAddress || "";

  return ip || null;
}

function hashIp(ip: string | null): string | null {
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}

function readDeviceType(userAgent: string | null): string {
  const value = userAgent?.toLowerCase() ?? "";

  if (!value) {
    return "unknown";
  }

  if (/bot|crawl|spider|slurp|bingpreview/.test(value)) {
    return "bot";
  }

  if (/ipad|tablet|kindle|silk/.test(value)) {
    return "tablet";
  }

  if (/mobile|android|iphone|ipod|windows phone/.test(value)) {
    return "mobile";
  }

  return "desktop";
}

function shouldTrack(request: Parameters<RequestHandler>[0]): boolean {
  if (request.method !== "GET") {
    return false;
  }

  const path = request.path;

  if (
    path.startsWith("/admin")
    || path.startsWith("/auth")
    || path.startsWith("/setup")
    || path.startsWith("/uploads")
    || path.startsWith("/assets")
    || path === "/health"
    || path === "/favicon.ico"
    || path === "/favicon.svg"
  ) {
    return false;
  }

  return path === "/" || path.startsWith("/zh") || path.startsWith("/en");
}

export function createVisitTrackingMiddleware(
  visitRepository = new VisitRepository()
): RequestHandler {
  return (request, _response, next) => {
    if (!shouldTrack(request)) {
      next();
      return;
    }

    const userAgent = truncate(firstHeaderValue(request.headers["user-agent"]));

    void visitRepository.create({
      country: readCountry(request.headers),
      deviceType: readDeviceType(userAgent),
      ipHash: hashIp(readClientIp(request)),
      locale: readLocale(request.path),
      path: request.originalUrl.slice(0, 512),
      referrer: truncate(firstHeaderValue(request.headers.referer)),
      userAgent
    }).catch(() => {
      // Analytics must never block public rendering.
    });

    next();
  };
}
