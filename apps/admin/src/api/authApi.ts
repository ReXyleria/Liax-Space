import { httpClient } from "./httpClient";
import type { AdminPermission } from "./roleApi";

export type AdminUserRole = string;

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: AdminUserRole;
  permissions?: AdminPermission[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  totpRequired: false;
  token: string;
  user: AdminUser;
} | {
  totpRequired: true;
  totpToken: string;
  user: AdminUser;
};

export type TotpLoginRequest = {
  code: string;
  totpToken: string;
};

export type TotpLoginResponse = {
  token: string;
  user: AdminUser;
};

export type MeResponse = {
  user: AdminUser;
};

export const authApi = {
  login(input: LoginRequest): Promise<LoginResponse> {
    return httpClient.post<LoginResponse>("/auth/login", input);
  },
  loginWithTotp(input: TotpLoginRequest): Promise<TotpLoginResponse> {
    return httpClient.post<TotpLoginResponse>("/auth/login/totp", input);
  },
  me(): Promise<MeResponse> {
    return httpClient.get<MeResponse>("/auth/me");
  }
};
