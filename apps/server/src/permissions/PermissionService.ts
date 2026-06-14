import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { isPermission, permissions, rolePermissions, type Permission } from "./permissions.js";
import type { Role } from "./roles.js";
import { RoleRepository, type RoleDefinition } from "./RoleRepository.js";

type RoleBody = Record<string, unknown>;

const roleKeyPattern = /^[a-z][a-z0-9_-]{1,31}$/;
const builtInRoleDisplayNames: Readonly<Record<Role, string>> = {
  admin: "Administer",
  guest: "Guest",
  ssvip: "SSVIP",
  svip: "SVIP"
};
const protectedRoleKey = "admin";

function validationError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function notFoundError(): AppError {
  return new AppError("Role not found.", {
    code: errorCodes.notFound,
    statusCode: 404
  });
}

function builtInRole(roleKey: string): RoleDefinition | null {
  if (roleKey !== protectedRoleKey) {
    return null;
  }

  return {
    builtIn: true,
    createdAt: new Date(0),
    displayName: builtInRoleDisplayNames.admin,
    permissions: [...rolePermissions.admin],
    roleKey,
    updatedAt: new Date(0)
  };
}

function parseRoleKey(value: unknown): string {
  if (typeof value !== "string" || !roleKeyPattern.test(value.trim())) {
    throw validationError("roleKey must start with a lowercase letter and contain 2-32 lowercase letters, numbers, hyphens, or underscores.");
  }

  return value.trim();
}

function parseDisplayName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw validationError("displayName is required.");
  }

  const displayName = value.trim();

  if (displayName.length > 64) {
    throw validationError("displayName must be 64 characters or fewer.");
  }

  return displayName;
}

function parsePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) {
    throw validationError("permissions must be an array.");
  }

  return [...new Set(value.map((permission) => {
    if (!isPermission(permission)) {
      throw validationError("permissions contains an unsupported value.");
    }

    return permission;
  }))];
}

export class PermissionService {
  constructor(private readonly roleRepository = new RoleRepository()) {}

  async listRoles(): Promise<RoleDefinition[]> {
    const storedRoles = await this.roleRepository.listRoles();

    if (storedRoles.some((role) => role.roleKey === protectedRoleKey)) {
      return storedRoles.map((role) => role.roleKey === protectedRoleKey ? { ...role, builtIn: true } : role);
    }

    return [builtInRole(protectedRoleKey), ...storedRoles]
      .filter((role): role is RoleDefinition => role !== null)
      .sort((left, right) => Number(right.builtIn) - Number(left.builtIn) || left.roleKey.localeCompare(right.roleKey));
  }

  listPermissions(): readonly Permission[] {
    return permissions;
  }

  async getRole(roleKey: string): Promise<RoleDefinition | null> {
    return await this.roleRepository.findByRoleKey(roleKey) ?? builtInRole(roleKey);
  }

  async roleExists(roleKey: string): Promise<boolean> {
    return (await this.getRole(roleKey)) !== null;
  }

  async getPermissionsForRole(role: string): Promise<readonly Permission[]> {
    const roleDefinition = await this.getRole(role);
    return roleDefinition?.permissions ?? [];
  }

  async hasPermission(role: unknown, permission: Permission): Promise<boolean> {
    if (typeof role !== "string") {
      return false;
    }

    return (await this.getPermissionsForRole(role)).includes(permission);
  }

  async assertPermission(role: unknown, permission: Permission): Promise<void> {
    if (!(await this.hasPermission(role, permission))) {
      throw new AppError("Permission denied.", {
        code: errorCodes.forbidden,
        statusCode: 403
      });
    }
  }

  async createRole(body: RoleBody): Promise<RoleDefinition> {
    const roleKey = parseRoleKey(body.roleKey);
    const displayName = parseDisplayName(body.displayName);
    const nextPermissions = parsePermissions(body.permissions);

    if (builtInRole(roleKey)) {
      throw validationError("Role already exists.");
    }

    if (await this.roleRepository.findByRoleKey(roleKey)) {
      throw validationError("Role already exists.");
    }

    return this.roleRepository.createRole({
      displayName,
      permissions: nextPermissions,
      roleKey
    });
  }

  async updateRole(roleKeyValue: unknown, body: RoleBody): Promise<RoleDefinition> {
    const roleKey = parseRoleKey(roleKeyValue);
    const existingRole = await this.getRole(roleKey);

    if (!existingRole) {
      throw notFoundError();
    }

    if (roleKey === protectedRoleKey) {
      throw validationError("Administer cannot be changed.");
    }

    const nextPermissions = parsePermissions(body.permissions);
    const updatedRole = await this.roleRepository.updateRole(roleKey, {
      displayName: parseDisplayName(body.displayName),
      permissions: nextPermissions
    });

    if (!updatedRole) {
      throw notFoundError();
    }

    return updatedRole;
  }

  async deleteRole(roleKeyValue: unknown): Promise<{ deleted: boolean }> {
    const roleKey = parseRoleKey(roleKeyValue);
    const existingRole = await this.roleRepository.findByRoleKey(roleKey);

    if (!existingRole) {
      throw notFoundError();
    }

    if (roleKey === protectedRoleKey) {
      throw validationError("Administer cannot be deleted.");
    }

    const usersWithRole = await this.roleRepository.countUsersByRole(roleKey);

    if (usersWithRole > 0) {
      throw validationError("Role is still assigned to active users.");
    }

    return {
      deleted: await this.roleRepository.deleteRole(roleKey)
    };
  }
}
