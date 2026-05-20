import { LoginEventMethod } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import { hashIp } from "@/lib/security";

type LoginEventMeta = {
  deviceName?: string | null;
  loginIp?: string | null;
};

export async function recordLoginEvent(userId: string, method: LoginEventMethod, meta?: LoginEventMeta) {
  if (!isDatabaseConfigured()) {
    return;
  }

  await db.loginEvent
    .create({
      data: {
        userId,
        method,
        deviceName: meta?.deviceName ? meta.deviceName.slice(0, 191) : null,
        ipHash: meta?.loginIp ? hashIp(meta.loginIp) : null
      }
    })
    .catch((error) => {
      console.warn("Skipped login event recording", error);
    });
}
