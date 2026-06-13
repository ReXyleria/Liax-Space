import type { RequestHandler } from "express";

import { JwtService, type AuthTokenPayload } from "../auth/JwtService.js";
import { AppError } from "./AppError.js";
import { errorCodes } from "./errorCodes.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

const jwtService = new JwtService();

function authenticationError(): AppError {
  return new AppError("Authentication required.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

function readBearerToken(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const parts = authorizationHeader.split(" ");

  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export const authRequired: RequestHandler = (request, _response, next) => {
  try {
    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      throw authenticationError();
    }

    request.auth = jwtService.verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
};
