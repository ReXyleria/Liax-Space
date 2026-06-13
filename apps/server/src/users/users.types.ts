export type UserRole = string;

export type User = {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  disabledAt: Date | null;
};

export type UserRecord = User & {
  passwordHash: string;
};

export type CreateUserInput = {
  username: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
};

export type CreateUserRecordInput = {
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

export type UserListInput = {
  limit?: number;
  offset?: number;
  search?: string;
};

export type UpdateUserRoleInput = {
  id: number;
  role: UserRole;
};
