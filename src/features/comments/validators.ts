import { CommentStatus } from "@prisma/client";
import { z } from "zod";

export const commentCreateSchema = z.object({
  articleId: z.string().min(1, "文章不存在"),
  parentId: z.string().optional().nullable(),
  content: z.string().trim().min(1, "评论不能为空").max(1000, "评论不能超过 1000 字"),
  deviceName: z.string().trim().max(80).optional().default("未知设备")
});

export const commentStatusSchema = z.object({
  id: z.string().min(1, "评论不存在"),
  status: z.nativeEnum(CommentStatus)
});
