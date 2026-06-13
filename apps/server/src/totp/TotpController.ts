import type { Request, Response } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { TotpService, type TotpLoginInput } from "./TotpService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";

function requireAuthUserId(request: Request): number {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth.userId;
}

function readStringField(body: unknown, field: keyof TotpLoginInput): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>)[field];

  return typeof value === "string" ? value : "";
}

export class TotpController {
  constructor(
    private readonly totpService = new TotpService(),
    private readonly auditLogService = new AuditLogService()
  ) {}

  setup = async (request: Request, response: Response): Promise<void> => {
    const result = await this.totpService.setup(requireAuthUserId(request));

    response.status(200).json(result);
  };

  confirm = async (request: Request, response: Response): Promise<void> => {
    const result = await this.totpService.confirm(requireAuthUserId(request), readStringField(request.body, "code"));

    response.status(200).json(result);
  };

  disable = async (request: Request, response: Response): Promise<void> => {
    const result = await this.totpService.disable(requireAuthUserId(request));

    response.status(200).json(result);
  };

  loginWithTotp = async (request: Request, response: Response): Promise<void> => {
    try {
      const result = await this.totpService.loginWithTotp({
        totpToken: readStringField(request.body, "totpToken"),
        code: readStringField(request.body, "code")
      });

      await this.auditLogService.recordFromRequest({
        action: "auth.login_success",
        entityId: result.user.id,
        entityType: "user",
        metadata: {
          method: "totp"
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
          method: "totp"
        },
        request,
        userId: null
      });

      throw error;
    }
  };
}
