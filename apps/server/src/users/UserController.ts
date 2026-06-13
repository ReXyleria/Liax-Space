import type { Request, Response } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { hashPassword } from "../auth/PasswordService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { UserService } from "./UserService.js";
import type { UserRole } from "./users.types.js";

function requireAuthUserId(request: Request): number {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth.userId;
}

function readPositiveId(value: unknown, fieldName: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`${fieldName} must be a positive integer.`, {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return id;
}

function readIdList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new AppError("ids must be an array.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return value.map((id) => readPositiveId(id, "id"));
}

function readRole(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("role is required.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return value.trim();
}

function readOptionalRole(value: unknown): UserRole | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return readRole(value) as UserRole;
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(`${fieldName} is required.`, {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return value.trim();
}

export class UserController {
  constructor(
    private readonly userService = new UserService(),
    private readonly auditLogService = new AuditLogService()
  ) {}

  listUsers = async (request: Request, response: Response): Promise<void> => {
    const users = await this.userService.listUsers({
      limit: request.query.limit === undefined ? undefined : Number(request.query.limit),
      offset: request.query.offset === undefined ? undefined : Number(request.query.offset),
      search: typeof request.query.search === "string" ? request.query.search : undefined
    });

    response.status(200).json({ users });
  };

  createUser = async (request: Request, response: Response): Promise<void> => {
    const actorUserId = requireAuthUserId(request);
    const username = readRequiredString(request.body?.username, "username");
    const email = readRequiredString(request.body?.email, "email");
    const password = readRequiredString(request.body?.password, "password");
    const role = readOptionalRole(request.body?.role);
    const passwordHash = await hashPassword(password);
    const user = await this.userService.createUser({
      email,
      passwordHash,
      role,
      username
    });

    await this.auditLogService.recordFromRequest({
      action: "user.created",
      entityId: user.id,
      entityType: "user",
      metadata: { role: user.role },
      request,
      userId: actorUserId
    });

    response.status(201).json({ user });
  };

  updateUserRole = async (request: Request, response: Response): Promise<void> => {
    const actorUserId = requireAuthUserId(request);
    const userId = readPositiveId(request.params.id, "user id");
    const role = readRole(request.body?.role);
    const user = await this.userService.updateUserRole(userId, role, actorUserId);

    await this.auditLogService.recordFromRequest({
      action: "user.role_updated",
      entityId: userId,
      entityType: "user",
      metadata: { role },
      request,
      userId: actorUserId
    });

    response.status(200).json({ user });
  };

  updateManyRoles = async (request: Request, response: Response): Promise<void> => {
    const actorUserId = requireAuthUserId(request);
    const ids = readIdList(request.body?.ids);
    const role = readRole(request.body?.role);
    const result = await this.userService.updateManyRoles(ids, role, actorUserId);

    await this.auditLogService.recordFromRequest({
      action: "user.batch_role_updated",
      entityType: "user",
      metadata: { count: result.updated, role },
      request,
      userId: actorUserId
    });

    response.status(200).json(result);
  };

  disableManyUsers = async (request: Request, response: Response): Promise<void> => {
    const actorUserId = requireAuthUserId(request);
    const ids = readIdList(request.body?.ids);
    const result = await this.userService.disableManyUsers(ids, actorUserId);

    await this.auditLogService.recordFromRequest({
      action: "user.batch_disabled",
      entityType: "user",
      metadata: { count: result.disabled },
      request,
      userId: actorUserId
    });

    response.status(200).json(result);
  };

  deleteManyUsers = async (request: Request, response: Response): Promise<void> => {
    const actorUserId = requireAuthUserId(request);
    const ids = readIdList(request.body?.ids);
    const result = await this.userService.deleteManyUsers(ids, actorUserId);

    await this.auditLogService.recordFromRequest({
      action: "user.batch_deleted",
      entityType: "user",
      metadata: { count: result.deleted, mode: "soft_delete" },
      request,
      userId: actorUserId
    });

    response.status(200).json(result);
  };
}
