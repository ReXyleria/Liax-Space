import { UserRole } from "@prisma/client";

export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  group: string;
};

export const permissionDefinitions: PermissionDefinition[] = [
  {
    key: "articles.manage",
    label: "管理文章",
    description: "创建、编辑、发布、归档和恢复文章。",
    group: "内容"
  },
  {
    key: "comments.manage",
    label: "管理评论",
    description: "审核、通过、隐藏和删除文章评论。",
    group: "内容"
  },
  {
    key: "moments.manage",
    label: "管理动态",
    description: "创建、编辑和删除动态。",
    group: "内容"
  },
  {
    key: "tags.manage",
    label: "管理标签",
    description: "创建、更新和合并文章标签。",
    group: "内容"
  },
  {
    key: "users.manage",
    label: "管理用户",
    description: "编辑用户资料、密码、角色、身份和状态。",
    group: "用户与权限"
  },
  {
    key: "identities.manage",
    label: "管理身份",
    description: "创建身份并自定义权限矩阵。",
    group: "用户与权限"
  },
  {
    key: "settings.manage",
    label: "管理设置",
    description: "编辑站点、首页、导航、页脚、SMTP 和安全设置。",
    group: "系统"
  },
  {
    key: "mailTemplates.manage",
    label: "管理邮件模板",
    description: "编辑通知模板、预览并测试发送。",
    group: "邮件"
  },
  {
    key: "codeInjection.manage",
    label: "管理代码注入",
    description: "编辑全局和文章代码注入片段。",
    group: "系统"
  },
  {
    key: "backupRestore.manage",
    label: "管理备份与恢复",
    description: "创建、下载、上传、恢复和删除备份。",
    group: "数据"
  },
  {
    key: "analytics.view",
    label: "查看统计",
    description: "查看基于数据库的统计仪表板。",
    group: "统计"
  }
];

export const permissionGroups = Array.from(new Set(permissionDefinitions.map((item) => item.group)));

export const allPermissionKeys = permissionDefinitions.map((item) => item.key);

export const defaultRolePermissions: Record<UserRole, string[]> = {
  USER: [],
  SVIP: [],
  SSVIP: [],
  Administer: allPermissionKeys
};

export const highPrivilegePermissions = new Set([
  "users.manage",
  "settings.manage",
  "identities.manage",
  "backupRestore.manage",
  "mailTemplates.manage",
  "codeInjection.manage"
]);

export const highPrivilegeRoles: UserRole[] = [UserRole.Administer];

export function getDefaultPermissionsForRole(role: UserRole) {
  return defaultRolePermissions[role] ?? [];
}

export function isHighPrivilegeIdentity(identity: { builtInRole: UserRole | null; permissions: unknown }) {
  if (identity.builtInRole && highPrivilegeRoles.includes(identity.builtInRole)) {
    return true;
  }

  if (!Array.isArray(identity.permissions)) {
    return false;
  }

  return identity.permissions.some(
    (permission) => typeof permission === "string" && highPrivilegePermissions.has(permission)
  );
}
