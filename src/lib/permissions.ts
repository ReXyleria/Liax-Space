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
  USER: 0,
  SVIP: 1,
  SSVIP: 2,
  Administer: 3
};

type RoleLike = UserRole | null | undefined;
type UserLike = (Pick<User, "role"> & {
  identity?: {
    permissions: unknown;
  } | null;
}) | null | undefined;

export function getRoleRank(role: RoleLike) {
  return role ? roleRank[role] : roleRank.USER;
}

export function getUserRole(user: UserLike): UserRole {
  return user?.role ?? UserRole.USER;
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

  if (role === UserRole.Administer) {
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

  if (role === UserRole.Administer) {
    return true;
  }

  if (visibility === ContentVisibility.LOGIN_REQUIRED) {
    return getRoleRank(role) >= getRoleRank(UserRole.USER);
  }

  if (visibility === ContentVisibility.SVIP_ONLY) {
    return getRoleRank(role) >= getRoleRank(UserRole.SVIP);
  }

  if (visibility === ContentVisibility.SSVIP_ONLY) {
    return getRoleRank(role) >= getRoleRank(UserRole.SSVIP);
  }

  if (visibility === ContentVisibility.Administer_ONLY) {
    return getRoleRank(role) >= getRoleRank(UserRole.Administer);
  }

  return false;
}

export function canAccessAdmin(user: UserLike) {
  return getRoleRank(getUserRole(user)) >= getRoleRank(UserRole.USER);
}

export function canManageArticles(user: UserLike) {
  return hasPermission(user, "articles.manage", UserRole.Administer);
}

export function canManageMoments(user: UserLike) {
  return hasPermission(user, "moments.manage", UserRole.Administer);
}

export function canManageComments(user: UserLike) {
  return hasPermission(user, "comments.manage", UserRole.Administer);
}

export function canManageGuestbook(user: UserLike) {
  return hasPermission(user, "comments.manage", UserRole.Administer);
}

export function canManageUsers(user: UserLike) {
  return hasPermission(user, "users.manage", UserRole.Administer);
}

export function canManageIdentities(user: UserLike) {
  return hasPermission(user, "identities.manage", UserRole.Administer);
}

export function canManageSettings(user: UserLike) {
  return hasPermission(user, "settings.manage", UserRole.Administer);
}

export function canManageCodeInjection(user: UserLike) {
  return getUserRole(user) === UserRole.Administer;
}

export function canViewAnalytics(user: UserLike) {
  return hasPermission(user, "analytics.view", UserRole.Administer);
}

export function canManageMailTemplates(user: UserLike) {
  return hasPermission(user, "mailTemplates.manage", UserRole.Administer);
}

export function canManageBackups(user: UserLike) {
  return hasPermission(user, "backupRestore.manage", UserRole.Administer);
}

export function assertPermission(allowed: boolean, message?: string) {
  if (!allowed) {
    throw new PermissionError(message);
  }
}
