import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { SetupController } from "./SetupController.js";

const setupController = new SetupController();

export const setupRoutes = Router();

setupRoutes.post("/admin", asyncHandler(setupController.initializeAdmin));
