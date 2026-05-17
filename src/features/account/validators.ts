import { z } from "zod";

export const profileUpdateSchema = z.object({
  nickname: z.string().trim().min(1, "昵称不能为空").max(32, "昵称不能超过 32 个字符"),
  avatar: z.string().max(500, "头像地址不能超过 500 个字符").optional().default("")
});

export const passwordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z
      .string()
      .min(8, "新密码至少 8 位")
      .regex(/[A-Za-z]/, "新密码需要包含字母")
      .regex(/[0-9]/, "新密码需要包含数字"),
    confirmPassword: z.string().min(1, "请再次输入新密码")
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "两次输入的新密码不一致"
  });

export const idSchema = z.object({
  id: z.string().min(1)
});
