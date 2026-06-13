import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionAnyRequired, permissionRequired } from "../common/permissionRequired.js";
import { PermissionService } from "./PermissionService.js";

const permissionService = new PermissionService();

export const permissionsRoutes = Router();

permissionsRoutes.get(
  "/roles",
  authRequired,
  permissionAnyRequired(["system:maintain", "user:manage", "article:publish"]),
  asyncHandler(async (_request, response) => {
    response.status(200).json({
      permissions: permissionService.listPermissions(),
      roles: await permissionService.listRoles()
    });
  })
);

permissionsRoutes.post(
  "/roles",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (request, response) => {
    response.status(201).json({
      role: await permissionService.createRole(request.body)
    });
  })
);

permissionsRoutes.patch(
  "/roles/:roleKey",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (request, response) => {
    response.status(200).json({
      role: await permissionService.updateRole(request.params.roleKey, request.body)
    });
  })
);

permissionsRoutes.delete(
  "/roles/:roleKey",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (request, response) => {
    response.status(200).json(await permissionService.deleteRole(request.params.roleKey));
  })
);
