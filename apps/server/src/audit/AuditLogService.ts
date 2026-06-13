import type { Request } from "express";

import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { AuditLogRepository } from "./AuditLogRepository.js";
import type { AuditLog, CreateAuditLogInput, ListAuditLogsInput } from "./AuditLogRepository.js";

type AuditRequestInput = Omit<CreateAuditLogInput, "ip" | "userAgent"> & {
  request: Request;
};

const sensitiveKeyPattern = /(password|token|secret|totp|passkey|credential|privatekey|private_key|publickey|public_key)/i;

function validationError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return parseOptionalString(value[0], fieldName);
  }

  if (typeof value !== "string") {
    throw validationError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalPositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 50;
  }

  const parsed = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
    throw validationError("limit must be an integer between 1 and 200.");
  }

  return parsed;
}

function parseOffset(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw validationError("offset must be a non-negative integer.");
  }

  return parsed;
}

function sanitizeMetadata(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) {
      continue;
    }

    sanitized[key] = sanitizeMetadata(nestedValue);
  }

  return sanitized;
}

function readUserAgent(request: Request): string | null {
  const userAgent = request.headers["user-agent"];

  if (Array.isArray(userAgent)) {
    return userAgent.join(", ").slice(0, 512);
  }

  return typeof userAgent === "string" ? userAgent.slice(0, 512) : null;
}

export class AuditLogService {
  constructor(private readonly auditLogRepository = new AuditLogRepository()) {}

  async record(input: CreateAuditLogInput): Promise<AuditLog> {
    return this.auditLogRepository.create({
      ...input,
      entityId: input.entityId === undefined || input.entityId === null ? null : input.entityId,
      metadata: sanitizeMetadata(input.metadata)
    });
  }

  async recordFromRequest(input: AuditRequestInput): Promise<AuditLog> {
    const { request, ...logInput } = input;

    return this.record({
      ...logInput,
      ip: request.ip ?? null,
      userAgent: readUserAgent(request),
      userId: input.userId === undefined ? request.auth?.userId ?? null : input.userId
    });
  }

  async list(query: Record<string, unknown>): Promise<AuditLog[]> {
    const input: ListAuditLogsInput = {
      action: parseOptionalString(query.action, "action"),
      entityId: parseOptionalString(query.entityId, "entityId"),
      entityType: parseOptionalString(query.entityType, "entityType"),
      limit: parseLimit(query.limit),
      offset: parseOffset(query.offset),
      userId: parseOptionalPositiveInteger(query.userId, "userId")
    };

    return this.auditLogRepository.list(input);
  }
}
