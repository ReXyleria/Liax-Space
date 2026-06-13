import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { hashPassword } from "../auth/PasswordService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { safeCompareToken } from "../common/randomToken.js";
import { storagePaths } from "../config/index.js";
import { UserService } from "../users/UserService.js";
import type { User } from "../users/users.types.js";

export type InitializeAdminInput = {
  setupToken: string;
  username: string;
  email: string;
  password: string;
};

export const SETUP_TOKEN_FILENAME = "setup-token";

export function getSetupTokenPath(): string {
  return path.join(storagePaths.runtimeDir, SETUP_TOKEN_FILENAME);
}

async function readSetupToken(setupTokenPath: string): Promise<string> {
  try {
    return (await readFile(setupTokenPath, "utf8")).trim();
  } catch {
    throw new AppError("Setup token is not available.", {
      code: errorCodes.forbidden,
      statusCode: 403
    });
  }
}

function assertInitializeAdminInput(input: InitializeAdminInput): void {
  if (!input.setupToken || !input.username || !input.email || !input.password) {
    throw new AppError("setupToken, username, email and password are required.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }
}

export class SetupService {
  constructor(private readonly userService = new UserService()) {}

  async initializeAdmin(input: InitializeAdminInput): Promise<User> {
    assertInitializeAdminInput(input);

    const existingAdmin = await this.userService.findAdminUser();

    if (existingAdmin) {
      throw new AppError("Admin user already exists.", {
        code: errorCodes.forbidden,
        statusCode: 403
      });
    }

    const setupTokenPath = getSetupTokenPath();
    const expectedToken = await readSetupToken(setupTokenPath);

    if (!safeCompareToken(input.setupToken.trim(), expectedToken)) {
      throw new AppError("Invalid setup token.", {
        code: errorCodes.unauthorized,
        statusCode: 401
      });
    }

    const passwordHash = await hashPassword(input.password);
    const adminUser = await this.userService.createUser({
      username: input.username,
      email: input.email,
      passwordHash,
      role: "admin"
    });

    await unlink(setupTokenPath);

    return adminUser;
  }
}
