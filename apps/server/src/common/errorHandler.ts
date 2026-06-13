import type { ErrorRequestHandler } from "express";
import { env } from "../config/index.js";
import { AppError } from "./AppError.js";
import { errorCodes } from "./errorCodes.js";
import { logger } from "./logger.js";

type HttpParserError = Error & {
  expose?: boolean;
  status?: number;
  statusCode?: number;
  type?: string;
};

function isHttpParserError(error: unknown): error is HttpParserError {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as HttpParserError;
  return typeof candidate.status === "number" || typeof candidate.statusCode === "number";
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isHttpParserError(error)) {
    const statusCode = error.statusCode ?? error.status ?? 400;
    const isPayloadTooLarge = statusCode === 413 || error.type === "entity.too.large";

    return new AppError(isPayloadTooLarge ? "Request body is too large." : error.message, {
      code: isPayloadTooLarge ? errorCodes.validationFailed : errorCodes.badRequest,
      statusCode,
      expose: error.expose ?? statusCode < 500
    });
  }

  if (error instanceof Error) {
    return new AppError(error.message, {
      code: errorCodes.internalServerError,
      statusCode: 500,
      expose: false
    });
  }

  return new AppError("Unexpected server error.", {
    code: errorCodes.internalServerError,
    statusCode: 500,
    expose: false
  });
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const appError = toAppError(error);
  const requestId = request.requestId;
  const message = appError.expose ? appError.message : "Internal server error.";
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error("request failed", {
    requestId,
    method: request.method,
    path: request.path,
    statusCode: appError.statusCode,
    errorCode: appError.code,
    errorMessage: appError.message,
    stack
  });

  response.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message,
      requestId,
      ...(env.appEnv === "production" ? {} : { stack })
    }
  });
};
