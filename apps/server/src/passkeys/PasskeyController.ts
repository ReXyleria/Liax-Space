import type { Request, Response } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { PasskeyService } from "./PasskeyService.js";

function requireAuthUserId(request: Request): number {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth.userId;
}

function readBodyRecord(request: Request): Record<string, unknown> {
  return request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
}

function readOptionalString(body: Record<string, unknown>, field: string): string | null {
  const value = body[field];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPasskeyId(request: Request): number {
  const id = Number(request.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Passkey id must be a positive integer.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return id;
}

export class PasskeyController {
  constructor(
    private readonly passkeyService = new PasskeyService(),
    private readonly auditLogService = new AuditLogService()
  ) {}

  registerOptions = async (request: Request, response: Response): Promise<void> => {
    const result = await this.passkeyService.createRegisterOptions(requireAuthUserId(request));

    response.status(200).json(result);
  };

  registerVerify = async (request: Request, response: Response): Promise<void> => {
    const body = readBodyRecord(request);
    const result = await this.passkeyService.verifyRegistration(requireAuthUserId(request), {
      credential: body.credential,
      deviceName: readOptionalString(body, "deviceName")
    });

    response.status(201).json({ passkey: result });
  };

  loginOptions = async (request: Request, response: Response): Promise<void> => {
    const body = readBodyRecord(request);
    const result = await this.passkeyService.createLoginOptions({
      email: readOptionalString(body, "email")
    });

    response.status(200).json(result);
  };

  loginVerify = async (request: Request, response: Response): Promise<void> => {
    const body = readBodyRecord(request);
    try {
      const result = await this.passkeyService.verifyLogin({
        credential: body.credential
      });

      await this.auditLogService.recordFromRequest({
        action: "auth.login_success",
        entityId: result.user.id,
        entityType: "user",
        metadata: {
          method: "passkey"
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
          method: "passkey"
        },
        request,
        userId: null
      });

      throw error;
    }
  };

  list = async (request: Request, response: Response): Promise<void> => {
    const passkeys = await this.passkeyService.listPasskeys(requireAuthUserId(request));

    response.status(200).json({ passkeys });
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const result = await this.passkeyService.deletePasskey(requireAuthUserId(request), readPasskeyId(request));

    response.status(200).json(result);
  };
}
