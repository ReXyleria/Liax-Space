import { httpClient } from "./httpClient";

export type AdminUserRole = string;

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: AdminUserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
};

export type UserListResponse = {
  users: AdminUser[];
};

export type BatchRoleResponse = {
  updated: number;
};

export type BatchDisableResponse = {
  disabled: number;
};

export type BatchDeleteResponse = {
  deleted: number;
};

export type CreateUserRequest = {
  username: string;
  email: string;
  password: string;
  role: AdminUserRole;
};

export const userApi = {
  listUsers(search = ""): Promise<UserListResponse> {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    const query = params.toString();
    return httpClient.get<UserListResponse>(query ? `/admin/users?${query}` : "/admin/users");
  },

  createUser(input: CreateUserRequest): Promise<{ user: AdminUser }> {
    return httpClient.post<{ user: AdminUser }>("/admin/users", input);
  },

  updateUserRole(id: number, role: AdminUserRole): Promise<{ user: AdminUser | null }> {
    return httpClient.patch<{ user: AdminUser | null }>(`/admin/users/${id}/role`, { role });
  },

  resetUserPassword(id: number, password: string): Promise<{ user: AdminUser | null }> {
    return httpClient.patch<{ user: AdminUser | null }>(`/admin/users/${id}/password`, { password });
  },

  disableUser(id: number): Promise<BatchDisableResponse> {
    return httpClient.post<BatchDisableResponse>("/admin/users/batch/disable", { ids: [id] });
  },

  updateManyRoles(ids: number[], role: AdminUserRole): Promise<BatchRoleResponse> {
    return httpClient.post<BatchRoleResponse>("/admin/users/batch/role", { ids, role });
  },

  disableManyUsers(ids: number[]): Promise<BatchDisableResponse> {
    return httpClient.post<BatchDisableResponse>("/admin/users/batch/disable", { ids });
  },

  deleteManyUsers(ids: number[]): Promise<BatchDeleteResponse> {
    return httpClient.post<BatchDeleteResponse>("/admin/users/batch/delete", { ids });
  }
};
