import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { DashboardService, type DashboardRange } from "./DashboardService.js";

const dashboardService = new DashboardService();

export const dashboardRoutes = Router();

function readRange(value: unknown): DashboardRange {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue === undefined || rawValue === "" ? 7 : Number(rawValue);

  if (parsed === 7 || parsed === 14 || parsed === 30) {
    return parsed;
  }

  throw new AppError("range must be 7, 14, or 30.", {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

dashboardRoutes.get(
  "/dashboard",
  authRequired,
  asyncHandler(async (request, response) => {
    const dashboard = await dashboardService.getSummary(readRange(request.query.range));

    response.status(200).json({ dashboard });
  })
);
