import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { GuestbookController } from "./GuestbookController.js";

const guestbookController = new GuestbookController();

export const guestbookRoutes = Router();

guestbookRoutes.get(
  "/guestbook",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(guestbookController.listEntries)
);

guestbookRoutes.patch(
  "/guestbook/:id",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(guestbookController.updateEntry)
);

guestbookRoutes.delete(
  "/guestbook/:id",
  authRequired,
  permissionRequired("article:delete"),
  asyncHandler(guestbookController.deleteEntry)
);
