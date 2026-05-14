import {
  ContentVisibility,
  UserRole,
  type User
} from "@prisma/client";
import {
  allPermissionKeys,
  getDefaultPermissionsForRole
} from "@/lib/permission-definitions";

export class PermissionError extends Error {
  constructor(message = "Permission denied") {
    super(message);
    this.name = "PermissionError";
  }
}

const roleRank: Record<UserRole, number> = {
  VISITOR: 0,
  USER: 1,
  FRIEND: 2,
  VIP: 3,
  EDITOR: 4,
  ADMIN: 5,
  OWNER: 6
};

type RoleLike = UserRole | null | undefined;
type UserLike = (Pick<User, "role"> & {
  identity?: {
    permissions: unknown;
  } | null;
}) | null | undefined;

export function getRoleRank(role: RoleLike) {
  return role ? roleRank[role] : roleRank.VISITOR;
}

export function getUserRole(user: UserLike): UserRole {
  return user?.role ?? UserRole.VISITOR;
}

function parsePermissionSet(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const allowed = new Set(allPermissionKeys);
  return new Set(value.filter((item): item is string => typeof item === "string" && allowed.has(item)));
}

function getIdentityPermissionSet(user: UserLike) {
  if (!user?.identity) {
    return null;
  }

  return parsePermissionSet(user.identity.permissions);
}

export function hasPermission(user: UserLike, permissionKey: string, fallbackRole?: UserRole) {
  const role = getUserRole(user);

  if (role === UserRole.OWNER) {
    return true;
  }

  const identityPermissions = getIdentityPermissionSet(user);
  if (identityPermissions) {
    return identityPermissions.has(permissionKey);
  }

  if (fallbackRole) {
    return getRoleRank(role) >= getRoleRank(fallbackRole);
  }

  return getDefaultPermissionsForRole(role).includes(permissionKey);
}

export function canViewContent(user: UserLike, visibility: ContentVisibility) {
  const role = getUserRole(user);

  if (visibility === ContentVisibility.PUBLIC) {
    return true;
  }

  if (role === UserRole.OWNER) {
    return true;
  }

  if (visibility === ContentVisibility.LOGIN_REQUIRED) {
    return getRoleRank(role) >= getRoleRank(UserRole.USER);
  }

  if (visibility === ContentVisibility.FRIEND_ONLY) {
    return getRoleRank(role) >= getRoleRank(UserRole.FRIEND);
  }

  if (visibility === ContentVisibility.VIP_ONLY) {
    return getRoleRank(role) >= getRoleRank(UserRole.VIP);
  }

  if (visibility === ContentVisibility.EDITOR_ONLY) {
    return getRoleRank(role) >= getRoleRank(UserRole.EDITOR);
  }

  if (visibility === ContentVisibility.ADMIN_ONLY) {
    return getRoleRank(role) >= getRoleRank(UserRole.ADMIN);
  }

  return false;
}

export function canAccessAdmin(user: UserLike) {
  return getRoleRank(getUserRole(user)) >= getRoleRank(UserRole.USER);
}

export function canManageArticles(user: UserLike) {
  return hasPermission(user, "articles.manage", UserRole.EDITOR);
}

export function canManageMoments(user: UserLike) {
  return hasPermission(user, "moments.manage", UserRole.EDITOR);
}

export function canManageComments(user: UserLike) {
  return hasPermission(user, "comments.manage", UserRole.ADMIN);
}

export function canManageGuestbook(user: UserLike) {
  return hasPermission(user, "comments.manage", UserRole.ADMIN);
}

export function canManageUsers(user: UserLike) {
  return hasPermission(user, "users.manage", UserRole.ADMIN);
}

export function canManageIdentities(user: UserLike) {
  return hasPermission(user, "identities.manage", UserRole.ADMIN);
}

export function canManageSettings(user: UserLike) {
  return hasPermission(user, "settings.manage", UserRole.ADMIN);
}

export function canManageCodeInjection(user: UserLike) {
  return getUserRole(user) === UserRole.OWNER;
}

export function canViewAnalytics(user: UserLike) {
  return hasPermission(user, "analytics.view", UserRole.ADMIN);
}

export function canManageMailTemplates(user: UserLike) {
  return hasPermission(user, "mailTemplates.manage", UserRole.ADMIN);
}

export function canManageBackups(user: UserLike) {
  return hasPermission(user, "backupRestore.manage", UserRole.ADMIN);
}

export function assertPermission(allowed: boolean, message?: string) {
  if (!allowed) {
    throw new PermissionError(message);
  }
}
