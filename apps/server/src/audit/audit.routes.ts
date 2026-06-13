import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { AuditLogService } from "./AuditLogService.js";

const auditLogService = new AuditLogService();

export const auditRoutes = Router();

auditRoutes.get(
  "/audit-logs",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (request, response) => {
    const auditLogs = await auditLogService.list(request.query);

    response.status(200).json({ auditLogs });
  })
);
