import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  email: z.string().trim().email("Enter a valid email address.").optional(),
  nickname: z.string().trim().min(2, "Nickname must be at least 2 characters.").max(32, "Nickname is too long.").optional(),
  password: z.string().min(8, "Password must be at least 8 characters.").optional().or(z.literal("")),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
  identityId: z.string().optional().nullable(),
  status: z.nativeEnum(UserStatus)
});

export const userCreateSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  username: z.string().trim().min(2, "Username must be at least 2 characters.").max(32, "Username is too long."),
  nickname: z.string().trim().min(2, "Nickname must be at least 2 characters.").max(32, "Nickname is too long."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters."),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
  identityId: z.string().optional().nullable(),
  status: z.nativeEnum(UserStatus),
  sendWelcomeEmail: z.boolean().default(false)
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match."
});
