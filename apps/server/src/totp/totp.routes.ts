import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { TotpController } from "./TotpController.js";

const totpController = new TotpController();

export const totpRoutes = Router();

totpRoutes.post("/totp/setup", authRequired, asyncHandler(totpController.setup));
totpRoutes.post("/totp/confirm", authRequired, asyncHandler(totpController.confirm));
totpRoutes.post("/totp/disable", authRequired, asyncHandler(totpController.disable));
totpRoutes.post("/login/totp", asyncHandler(totpController.loginWithTotp));
