import type { Request, Response } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { AuthService, type LoginInput } from "./AuthService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";

function readStringField(body: unknown, field: keyof LoginInput): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>)[field];

  return typeof value === "string" ? value : "";
}

function requireAuth(request: Request) {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth;
}

export class AuthController {
  constructor(
    private readonly authService = new AuthService(),
    private readonly auditLogService = new AuditLogService()
  ) {}

  login = async (request: Request, response: Response): Promise<void> => {
    const email = readStringField(request.body, "email").trim().toLowerCase();

    try {
      const result = await this.authService.login({
        email,
        password: readStringField(request.body, "password")
      });

      await this.auditLogService.recordFromRequest({
        action: result.totpRequired ? "auth.login_challenge" : "auth.login_success",
        entityId: result.user.id,
        entityType: "user",
        metadata: {
          email,
          method: "password",
          secondFactorRequired: result.totpRequired
        },
        request,
        userId: result.user.id
      });

      response.status(200).json(result);
    } catch (error) {
      await this.auditLogService.recordFromRequest({
        action: "auth.login_failed",
        entityType: "auth",
        metadata: {
          email,
          method: "password"
        },
        request,
        userId: null
      });

      throw error;
    }
  };

  me = async (request: Request, response: Response): Promise<void> => {
    const user = await this.authService.getCurrentUser(requireAuth(request));

    response.status(200).json({ user });
  };
}
