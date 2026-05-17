import { CommentStatus } from "@prisma/client";
import { z } from "zod";

export const commentCreateSchema = z.object({
  articleId: z.string().min(1, "文章不存在"),
  parentId: z.string().optional().nullable(),
  content: z.string().trim().min(1, "评论不能为空").max(1000, "评论不能超过 1000 字"),
  deviceName: z.string().trim().max(80).optional().default("Unknown device")
});

export const commentStatusSchema = z.object({
  id: z.string().min(1, "评论不存在"),
  status: z.nativeEnum(CommentStatus)
});

export const muteUserSchema = z.object({
  userId: z.string().min(1, "用户不存在"),
  duration: z.enum(["1h", "3h", "5h", "1d", "1mo", "permanent"])
});

export const MUTE_DURATIONS: Record<string, number> = {
  "1h": 3600000,
  "3h": 10800000,
  "5h": 18000000,
  "1d": 86400000,
  "1mo": 2592000000,
  permanent: 0
};
