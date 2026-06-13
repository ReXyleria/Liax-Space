import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { PasskeyController } from "./PasskeyController.js";

const passkeyController = new PasskeyController();

export const passkeyRoutes = Router();

passkeyRoutes.post("/passkeys/register/options", authRequired, asyncHandler(passkeyController.registerOptions));
passkeyRoutes.post("/passkeys/register/verify", authRequired, asyncHandler(passkeyController.registerVerify));
passkeyRoutes.post("/passkeys/login/options", asyncHandler(passkeyController.loginOptions));
passkeyRoutes.post("/passkeys/login/verify", asyncHandler(passkeyController.loginVerify));
passkeyRoutes.get("/passkeys", authRequired, asyncHandler(passkeyController.list));
passkeyRoutes.delete("/passkeys/:id", authRequired, asyncHandler(passkeyController.delete));
