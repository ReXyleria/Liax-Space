import type { Request, Response } from "express";

import { SetupService, type InitializeAdminInput } from "./SetupService.js";

function readStringField(body: unknown, field: keyof InitializeAdminInput): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>)[field];

  return typeof value === "string" ? value : "";
}

export class SetupController {
  constructor(private readonly setupService = new SetupService()) {}

  initializeAdmin = async (request: Request, response: Response): Promise<void> => {
    const adminUser = await this.setupService.initializeAdmin({
      setupToken: readStringField(request.body, "setupToken"),
      username: readStringField(request.body, "username"),
      email: readStringField(request.body, "email"),
      password: readStringField(request.body, "password")
    });

    response.status(201).json({
      user: adminUser
    });
  };
}
