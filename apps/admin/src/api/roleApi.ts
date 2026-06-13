import { httpClient } from "./httpClient";

export type AdminPermission =
  | "article:create"
  | "article:update"
  | "article:publish"
  | "article:delete"
  | "attachment:upload"
  | "user:manage"
  | "system:maintain";

export type AdminRoleDefinition = {
  roleKey: string;
  displayName: string;
  permissions: AdminPermission[];
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoleListResponse = {
  permissions: AdminPermission[];
  roles: AdminRoleDefinition[];
};

export type RoleInput = {
  roleKey?: string;
  displayName: string;
  permissions: AdminPermission[];
};

export const roleApi = {
  createRole(input: Required<Pick<RoleInput, "roleKey" | "displayName" | "permissions">>): Promise<{ role: AdminRoleDefinition }> {
    return httpClient.post<{ role: AdminRoleDefinition }>("/admin/roles", input);
  },
  deleteRole(roleKey: string): Promise<{ deleted: boolean }> {
    return httpClient.delete<{ deleted: boolean }>(`/admin/roles/${encodeURIComponent(roleKey)}`);
  },
  listRoles(): Promise<RoleListResponse> {
    return httpClient.get<RoleListResponse>("/admin/roles");
  },
  updateRole(roleKey: string, input: Pick<RoleInput, "displayName" | "permissions">): Promise<{ role: AdminRoleDefinition }> {
    return httpClient.patch<{ role: AdminRoleDefinition }>(`/admin/roles/${encodeURIComponent(roleKey)}`, input);
  }
};
