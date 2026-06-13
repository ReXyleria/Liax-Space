import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { UserController } from "./UserController.js";

const userController = new UserController();

export const userRoutes = Router();

userRoutes.get("/users", authRequired, permissionRequired("user:manage"), asyncHandler(userController.listUsers));
userRoutes.post("/users", authRequired, permissionRequired("user:manage"), asyncHandler(userController.createUser));
userRoutes.patch("/users/:id/role", authRequired, permissionRequired("user:manage"), asyncHandler(userController.updateUserRole));
userRoutes.post("/users/batch/role", authRequired, permissionRequired("user:manage"), asyncHandler(userController.updateManyRoles));
userRoutes.post("/users/batch/disable", authRequired, permissionRequired("user:manage"), asyncHandler(userController.disableManyUsers));
userRoutes.post("/users/batch/delete", authRequired, permissionRequired("user:manage"), asyncHandler(userController.deleteManyUsers));
