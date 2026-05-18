import { GuestbookStatus } from "@prisma/client";
import { z } from "zod";

export const guestbookCreateSchema = z.object({
  nickname: z.string().trim().min(1, "昵称不能为空。").max(32, "昵称不能超过 32 个字符。"),
  email: z.string().trim().email("请输入有效邮箱。").max(120, "邮箱不能超过 120 个字符。"),
  content: z.string().trim().min(1, "留言不能为空。").max(1000, "留言不能超过 1000 字。"),
  notifyOnly: z.boolean().default(false)
});

export const guestbookModerationSchema = z.object({
  id: z.string().min(1, "留言不存在。"),
  reply: z.string().max(1000, "回复不能超过 1000 字。").optional(),
  status: z.nativeEnum(GuestbookStatus)
});

export const guestbookCommentCreateSchema = z.object({
  messageId: z.string().min(1, "留言不存在。"),
  nickname: z.string().trim().min(1, "昵称不能为空。").max(32, "昵称不能超过 32 个字符。"),
  email: z.string().trim().email("请输入有效邮箱。").max(120, "邮箱不能超过 120 个字符。"),
  content: z.string().trim().min(1, "评论不能为空。").max(500, "评论不能超过 500 字。")
});

export const guestbookLikeSchema = z.object({
  messageId: z.string().min(1, "留言不存在。")
});
