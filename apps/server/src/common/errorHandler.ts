import type { ErrorRequestHandler } from "express";
import { env } from "../config/index.js";
import { AppError } from "./AppError.js";
import { errorCodes } from "./errorCodes.js";
import { logger } from "./logger.js";

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
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

