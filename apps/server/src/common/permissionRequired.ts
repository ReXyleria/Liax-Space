import type { RequestHandler } from "express";

import { AppError } from "./AppError.js";
import { errorCodes } from "./errorCodes.js";
import { PermissionService } from "../permissions/PermissionService.js";
import type { Permission } from "../permissions/permissions.js";

const permissionService = new PermissionService();

function authenticationError(): AppError {
  return new AppError("Authentication required.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

export function permissionRequired(permission: Permission): RequestHandler {
  return (request, _response, next) => {
    try {
      if (!request.auth) {
        throw authenticationError();
      }

      void permissionService.assertPermission(request.auth.role, permission)
        .then(() => next())
        .catch(next);
    } catch (error) {
      next(error);
    }
  };
}

export function permissionAnyRequired(permissions: Permission[]): RequestHandler {
  return (request, _response, next) => {
    try {
      if (!request.auth) {
        throw authenticationError();
      }

      void Promise.all(permissions.map((permission) => permissionService.hasPermission(request.auth?.role, permission)))
        .then((results) => {
          if (!results.some(Boolean)) {
            throw new AppError("Permission denied.", {
              code: errorCodes.forbidden,
              statusCode: 403
            });
          }

          next();
        })
        .catch(next);
    } catch (error) {
      next(error);
    }
  };
}
