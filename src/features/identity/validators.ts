import { UserRole } from "@prisma/client";
import { z } from "zod";
import { allPermissionKeys } from "@/lib/permission-definitions";

const permissionKeySchema = z.enum(allPermissionKeys as [string, ...string[]]);

export const identityInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "Identity key must be at least 2 characters.")
    .max(48, "Identity key must be 48 characters or fewer.")
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and dashes only."),
  name: z.string().trim().min(2, "Identity name is required.").max(48, "Identity name is too long."),
  description: z.string().trim().max(500, "Description is too long.").optional(),
  permissions: z.array(permissionKeySchema).default([])
});

export const identityUpdateSchema = identityInputSchema.extend({
  id: z.string().min(1),
  builtInRole: z.nativeEnum(UserRole).optional().nullable()
});

export const userSessionDeleteSchema = z.object({
  id: z.string().min(1)
});
