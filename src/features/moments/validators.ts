import { ContentVisibility } from "@prisma/client";
import { z } from "zod";

export const momentMutationSchema = z.object({
  id: z.string().cuid().optional(),
  content: z.string().trim().min(1, "瞬间内容不能为空。").max(1000, "瞬间内容不能超过 1000 个字符。"),
  images: z.array(z.string().url("图片地址格式不正确。")).max(9, "最多上传 9 张图片。").default([]),
  visibility: z.nativeEnum(ContentVisibility).default(ContentVisibility.PUBLIC),
  pinned: z.boolean().default(false)
});

export const momentCommentSchema = z.object({
  momentId: z.string().min(1, "瞬间不存在。"),
  content: z.string().trim().min(1, "评论不能为空。").max(600, "评论不能超过 600 个字符。"),
  deviceName: z.string().trim().max(80).optional().default("未知设备")
});
