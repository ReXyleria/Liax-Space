import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { passkeyRoutes } from "../passkeys/passkeys.routes.js";
import { totpRoutes } from "../totp/totp.routes.js";
import { AuthController } from "./AuthController.js";

const authController = new AuthController();

export const authRoutes = Router();

authRoutes.post("/login", asyncHandler(authController.login));
authRoutes.get("/me", authRequired, asyncHandler(authController.me));
authRoutes.use(passkeyRoutes);
authRoutes.use(totpRoutes);
