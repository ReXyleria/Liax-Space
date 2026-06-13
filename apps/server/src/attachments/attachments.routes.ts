import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { AttachmentController } from "./AttachmentController.js";

const attachmentController = new AttachmentController();

export const attachmentRoutes = Router();

attachmentRoutes.post(
  "/me/avatar",
  authRequired,
  asyncHandler(attachmentController.uploadAvatar)
);

attachmentRoutes.get(
  "/attachments",
  authRequired,
  permissionRequired("attachment:upload"),
  asyncHandler(attachmentController.listAttachments)
);

attachmentRoutes.post(
  "/attachments",
  authRequired,
  permissionRequired("attachment:upload"),
  asyncHandler(attachmentController.uploadAttachment)
);

attachmentRoutes.delete(
  "/attachments",
  authRequired,
  permissionRequired("attachment:upload"),
  asyncHandler(attachmentController.deleteUnusedAttachments)
);
