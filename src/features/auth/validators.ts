import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.")
});

export const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(32, "Username must be 32 characters or fewer.")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may contain letters, numbers, and underscores only."),
  nickname: z.string().trim().min(2, "Nickname must be at least 2 characters.").max(32, "Nickname is too long."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Za-z]/, "Password must contain a letter.")
    .regex(/\d/, "Password must contain a number."),
  emailCode: z.string().trim().min(4, "Enter the verification code.").max(8, "Verification code is invalid.")
});

export const loginSchema = z.object({
  account: z.string().trim().min(1, "Enter username or email.").max(120, "Account is too long."),
  password: z.string().min(1, "Enter password."),
  callbackUrl: z.string().optional()
});

export const loginSecondFactorSchema = z.object({
  pendingToken: z.string().trim().min(1, "Second-factor session is missing."),
  emailCode: z.string().optional(),
  totpCode: z.string().optional(),
  recoveryCode: z.string().optional(),
  trustDevice: z.boolean().optional(),
  callbackUrl: z.string().optional()
});
