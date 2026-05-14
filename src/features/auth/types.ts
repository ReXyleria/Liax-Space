import type { UserRole } from "@prisma/client";

export type AuthResponse = {
  ok: boolean;
  message: string;
  redirectTo?: string;
  requiresTotp?: boolean;
  requiresSecondFactor?: boolean;
  pendingToken?: string;
  secondFactors?: Array<"totp" | "passkey">;
};

export type SafeSessionUser = {
  id: string;
  email: string;
  username: string | null;
  nickname: string;
  role: UserRole;
};
