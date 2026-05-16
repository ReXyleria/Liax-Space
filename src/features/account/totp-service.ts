import { randomBytes } from "crypto";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/security";

const RECOVERY_CODE_COUNT = 10;

function normalizeCode(code: string | null | undefined) {
  return (code ?? "").replace(/\s+/g, "").trim();
}

function createRecoveryCode() {
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

async function createRecoveryCodes(userId: string) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, createRecoveryCode);
  await db.totpRecoveryCode.deleteMany({ where: { userId } });
  await db.totpRecoveryCode.createMany({
    data: await Promise.all(codes.map(async (code) => ({
      userId,
      codeHash: await hashPassword(code)
    })))
  });
  return codes;
}

export async function beginTotpSetup(user: CurrentUser) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const secret = generateSecret();
  let issuer = process.env.PASSKEY_RP_NAME || "";

  if (!issuer) {
    try {
      const setting = await db.setting.findUnique({ where: { key: "passkey.rpName" } });
      issuer = setting?.value || "";
    } catch {
      // Ignore, use fallback
    }
  }

  issuer = issuer || "Liax-Space";
  const otpauthUrl = generateURI({
    issuer,
    label: user.email,
    secret,
    digits: 6,
    period: 30
  });

  await db.user.update({
    where: { id: user.id },
    data: {
      totpSecret: secret,
      totpEnabled: false,
      totpConfirmedAt: null
    }
  });

  return {
    secret,
    qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl)
  };
}

export async function confirmTotpSetup(user: CurrentUser, code: string) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { totpSecret: true }
  });

  if (!record?.totpSecret) {
    throw new Error("Start TOTP setup before verifying a code.");
  }

  const verified = await verify({
    secret: record.totpSecret,
    token: normalizeCode(code),
    digits: 6,
    period: 30,
    epochTolerance: 30
  });
  if (!verified.valid) {
    throw new Error("Invalid TOTP code.");
  }

  const recoveryCodes = await createRecoveryCodes(user.id);
  await db.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: true,
      totpConfirmedAt: new Date()
    }
  });

  return recoveryCodes;
}

export async function verifyTotpOrRecovery(userId: string, code?: string | null, recoveryCode?: string | null) {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const normalizedCode = normalizeCode(code);
  const normalizedRecovery = normalizeCode(recoveryCode).toUpperCase();
  const record = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true }
  });

  if (!record?.totpEnabled || !record.totpSecret) {
    return true;
  }

  if (normalizedCode) {
    const result = await verify({
      secret: record.totpSecret,
      token: normalizedCode,
      digits: 6,
      period: 30,
      epochTolerance: 30
    });

    if (result.valid) {
      return true;
    }
  }

  if (!normalizedRecovery) {
    return false;
  }

  const recoveryCodes = await db.totpRecoveryCode.findMany({
    where: {
      userId,
      usedAt: null
    },
    select: {
      id: true,
      codeHash: true
    }
  });

  for (const recovery of recoveryCodes) {
    if (await verifyPassword(normalizedRecovery, recovery.codeHash)) {
      await db.totpRecoveryCode.update({
        where: { id: recovery.id },
        data: { usedAt: new Date() }
      });
      return true;
    }
  }

  return false;
}

export async function disableTotp(user: CurrentUser, input: { currentPassword: string; code?: string; recoveryCode?: string }) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: {
      passwordHash: true,
      totpEnabled: true
    }
  });

  if (!record) {
    throw new Error("User not found.");
  }

  if (!record.totpEnabled) {
    throw new Error("TOTP is not enabled.");
  }

  const passwordOk = await verifyPassword(input.currentPassword, record.passwordHash);
  if (!passwordOk) {
    throw new Error("Current password is incorrect.");
  }

  const secondFactorOk = await verifyTotpOrRecovery(user.id, input.code, input.recoveryCode);
  if (!secondFactorOk) {
    throw new Error("TOTP or recovery code is invalid.");
  }

  await db.$transaction([
    db.totpRecoveryCode.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: false,
        totpConfirmedAt: null,
        totpSecret: null
      }
    })
  ]);
}
