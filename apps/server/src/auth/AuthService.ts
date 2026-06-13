import { verifyPassword } from "./PasswordService.js";
import { JwtService, type AuthTokenPayload } from "./JwtService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { TotpService } from "../totp/TotpService.js";
import { UserRepository } from "../users/UserRepository.js";
import type { User, UserRecord } from "../users/users.types.js";
import { PermissionService } from "../permissions/PermissionService.js";
import type { Permission } from "../permissions/permissions.js";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  totpRequired: false;
  token: string;
  user: AuthenticatedUser;
} | {
  totpRequired: true;
  totpToken: string;
  user: AuthenticatedUser;
};

export type AuthenticatedUser = User & {
  permissions: readonly Permission[];
};

function toUser(userRecord: UserRecord): User {
  const { passwordHash: _passwordHash, ...user } = userRecord;

  return user;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function loginFailedError(): AppError {
  return new AppError("Invalid email or password.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

function authenticationError(): AppError {
  return new AppError("Authentication required.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

export class AuthService {
  private readonly totpService: TotpService;

  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly jwtService = new JwtService(),
    totpService?: TotpService,
    private readonly permissionService = new PermissionService()
  ) {
    this.totpService = totpService ?? new TotpService(this.userRepository, this.jwtService);
  }

  private async toAuthenticatedUser(userRecord: UserRecord): Promise<AuthenticatedUser> {
    const user = toUser(userRecord);

    return {
      ...user,
      permissions: await this.permissionService.getPermissionsForRole(user.role)
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const email = normalizeEmail(input.email);

    if (!email || !input.password) {
      throw loginFailedError();
    }

    const userRecord = await this.userRepository.findByEmail(email);

    if (!userRecord || userRecord.disabledAt) {
      throw loginFailedError();
    }

    const passwordMatches = await verifyPassword(input.password, userRecord.passwordHash);

    if (!passwordMatches) {
      throw loginFailedError();
    }

    if (await this.totpService.isTotpEnabled(userRecord.id)) {
      return {
        totpRequired: true,
        totpToken: this.jwtService.createTotpChallengeToken({
          userId: userRecord.id,
          role: userRecord.role
        }),
        user: await this.toAuthenticatedUser(userRecord)
      };
    }

    const updatedUserRecord = await this.userRepository.updateLastLoginAt(userRecord.id);
    const user = await this.toAuthenticatedUser(updatedUserRecord ?? userRecord);
    const token = this.jwtService.createToken({
      userId: user.id,
      role: user.role
    });

    return { totpRequired: false, token, user };
  }

  async getCurrentUser(auth: AuthTokenPayload): Promise<AuthenticatedUser> {
    const userRecord = await this.userRepository.findById(auth.userId);

    if (!userRecord || userRecord.disabledAt) {
      throw authenticationError();
    }

    return this.toAuthenticatedUser(userRecord);
  }
}
