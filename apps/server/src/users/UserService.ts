import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { PermissionService } from "../permissions/PermissionService.js";
import { UserRepository } from "./UserRepository.js";
import type { CreateUserInput, User, UserListInput, UserRecord, UserRole } from "./users.types.js";

function toUser(userRecord: UserRecord): User {
  const { passwordHash: _passwordHash, ...user } = userRecord;

  return user;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string): string {
  return username.trim();
}

function assertPositiveId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("User id must be a positive integer.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }
}

function normalizeIds(ids: number[]): number[] {
  const uniqueIds = [...new Set(ids.map((id) => Number(id)))];

  for (const id of uniqueIds) {
    assertPositiveId(id);
  }

  return uniqueIds;
}

function assertCreateUserInput(input: CreateUserInput): void {
  if (!normalizeUsername(input.username)) {
    throw new AppError("Username is required.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  if (!normalizeEmail(input.email)) {
    throw new AppError("Email is required.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  if (!input.passwordHash) {
    throw new AppError("Password hash is required.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }
}

export class UserService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly permissionService = new PermissionService()
  ) {}

  async listUsers(input: UserListInput = {}): Promise<User[]> {
    const userRecords = await this.userRepository.listUsers({
      limit: input.limit,
      offset: input.offset,
      search: input.search?.trim()
    });

    return userRecords.map(toUser);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    assertCreateUserInput(input);
    const role = input.role ?? "viewer";
    await this.assertUserRole(role);

    const userRecord = await this.userRepository.createUser({
      username: normalizeUsername(input.username),
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      role
    });

    return toUser(userRecord);
  }

  async findById(id: number): Promise<User | null> {
    assertPositiveId(id);

    const userRecord = await this.userRepository.findById(id);

    return userRecord ? toUser(userRecord) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      throw new AppError("Email is required.", {
        code: errorCodes.validationFailed,
        statusCode: 400
      });
    }

    const userRecord = await this.userRepository.findByEmail(normalizedEmail);

    return userRecord ? toUser(userRecord) : null;
  }

  async findAdminUser(): Promise<User | null> {
    const userRecord = await this.userRepository.findAdminUser();

    return userRecord ? toUser(userRecord) : null;
  }

  async updateLastLoginAt(id: number): Promise<User | null> {
    assertPositiveId(id);

    const userRecord = await this.userRepository.updateLastLoginAt(id);

    return userRecord ? toUser(userRecord) : null;
  }

  async disableUser(id: number): Promise<User | null> {
    assertPositiveId(id);

    const userRecord = await this.userRepository.disableUser(id);

    return userRecord ? toUser(userRecord) : null;
  }

  async updateUserRole(id: number, role: string, actorUserId: number): Promise<User | null> {
    assertPositiveId(id);
    assertPositiveId(actorUserId);
    await this.assertUserRole(role);

    if (id === actorUserId) {
      throw new AppError("Users cannot change their own role.", {
        code: errorCodes.validationFailed,
        statusCode: 400
      });
    }

    const userRecord = await this.userRepository.updateUserRole({ id, role });

    return userRecord ? toUser(userRecord) : null;
  }

  async updateManyRoles(ids: number[], role: string, actorUserId: number): Promise<{ updated: number }> {
    assertPositiveId(actorUserId);
    await this.assertUserRole(role);

    const userIds = normalizeIds(ids).filter((id) => id !== actorUserId);
    const updated = await this.userRepository.updateManyRoles(userIds, role);

    return { updated };
  }

  async disableManyUsers(ids: number[], actorUserId: number): Promise<{ disabled: number }> {
    assertPositiveId(actorUserId);

    const userIds = normalizeIds(ids).filter((id) => id !== actorUserId);
    const disabled = await this.userRepository.disableManyUsers(userIds);

    return { disabled };
  }

  async deleteManyUsers(ids: number[], actorUserId: number): Promise<{ deleted: number }> {
    const result = await this.disableManyUsers(ids, actorUserId);

    return { deleted: result.disabled };
  }

  private async assertUserRole(value: string): Promise<void> {
    if (!value.trim() || !(await this.permissionService.roleExists(value))) {
      throw new AppError("User role is invalid.", {
        code: errorCodes.validationFailed,
        statusCode: 400
      });
    }
  }
}
