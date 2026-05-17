import { ContentVisibility } from "@prisma/client";
import { z } from "zod";

const uploadedImageSchema = z.string().trim().refine((value) => {
  if (value.startsWith("/uploads/") || value.startsWith("/api/runtime-uploads/")) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}, "图片地址必须是本站上传路径或完整 URL。");

export const momentMutationSchema = z.object({
  id: z.string().cuid().optional(),
  content: z.string().trim().min(1, "瞬间内容不能为空。").max(1000, "瞬间内容不能超过 1000 个字符。"),
  images: z.array(uploadedImageSchema).max(9, "最多上传 9 张图片。").default([]),
  visibility: z.nativeEnum(ContentVisibility).default(ContentVisibility.PUBLIC),
  pinned: z.boolean().default(false),
  createdAt: z.string().datetime({ offset: true }).optional().nullable()
    .transform((value) => value ? new Date(value) : undefined)
});

export const momentCommentSchema = z.object({
  momentId: z.string().min(1, "瞬间不存在。"),
  content: z.string().trim().min(1, "评论不能为空。").max(600, "评论不能超过 600 个字符。"),
  deviceName: z.string().trim().max(80).optional().default("未知设备")
});
