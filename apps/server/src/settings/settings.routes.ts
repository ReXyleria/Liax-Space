import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { SiteSettingsService } from "./SiteSettingsService.js";
import { UserPreferencesService } from "./UserPreferencesService.js";
import type { UserPreferences } from "./settings.types.js";

const siteSettingsService = new SiteSettingsService();
const userPreferencesService = new UserPreferencesService();

export const settingsRoutes = Router();

function requireAuthUserId(request: { auth?: { userId: number } }): number {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth.userId;
}

function serializePreferences(preferences: UserPreferences) {
  return {
    userId: preferences.userId,
    locale: preferences.locale,
    reduced_motion: preferences.reducedMotion,
    avatar_attachment_id: preferences.avatarAttachmentId,
    avatar_public_url: preferences.avatarPublicUrl,
    createdAt: preferences.createdAt,
    updatedAt: preferences.updatedAt
  };
}

settingsRoutes.get(
  "/settings/site",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (_request, response) => {
    response.status(200).json({
      settings: await siteSettingsService.getSiteSettings()
    });
  })
);

settingsRoutes.patch(
  "/settings/site",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (request, response) => {
    response.status(200).json({
      settings: await siteSettingsService.updateSiteSettings(request.body)
    });
  })
);

settingsRoutes.get(
  "/me/preferences",
  authRequired,
  asyncHandler(async (request, response) => {
    response.status(200).json({
      preferences: serializePreferences(await userPreferencesService.getPreferences(requireAuthUserId(request)))
    });
  })
);

settingsRoutes.patch(
  "/me/preferences",
  authRequired,
  asyncHandler(async (request, response) => {
    response.status(200).json({
      preferences: serializePreferences(
        await userPreferencesService.updatePreferences(requireAuthUserId(request), {
          avatarAttachmentId: request.body?.avatar_attachment_id,
          locale: request.body?.locale,
          reducedMotion: request.body?.reduced_motion
        })
      )
    });
  })
);
