import { z } from "zod";

export const tagMutationSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "标签名称不能为空。").max(30, "标签名称不能超过 30 个字符。"),
  slug: z.string().trim().max(60, "标签别名不能超过 60 个字符。").optional().default(""),
  color: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "")
    .refine((value) => !value || /^#[0-9a-fA-F]{6}$/.test(value), "颜色必须是 #RRGGBB 格式。")
});

