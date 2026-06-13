import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "./logger.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const requestIdHeader = "x-request-id";

function readIncomingRequestId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : null;
}

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  const requestId = readIncomingRequestId(request.headers[requestIdHeader]) ?? randomUUID();

  request.requestId = requestId;
  response.setHeader(requestIdHeader, requestId);

  response.on("finish", () => {
    logger.info("request completed", {
      requestId,
      method: request.method,
      path: request.path,
      statusCode: response.statusCode
    });
  });

  next();
};

