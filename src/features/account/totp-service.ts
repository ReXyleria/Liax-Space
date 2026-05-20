import { randomBytes } from "crypto";
import { VerificationCodeType } from "@prisma/client";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { sendTotpDisableCodeMail } from "@/lib/mail";
import { generateNumericCode, hashPassword, verifyPassword } from "@/lib/security";

const RECOVERY_CODE_COUNT = 10;
const TOTP_DISABLE_CODE_TTL_MINUTES = 10;

export type TotpVerificationResult =
  | { ok: true; method: "totp" | "recovery" }
  | { ok: false };

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
    throw new Error("DATABASE_URL 未配置。");
  }

  const secret = generateSecret();
  let issuer = process.env.PASSKEY_RP_NAME || "";

  if (!issuer) {
    try {
      const setting = await db.setting.findUnique({ where: { key: "passkey.rpName" } });
      issuer = setting?.value || "";
    } catch {
      // Use the product fallback below when settings are unavailable.
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
    throw new Error("DATABASE_URL 未配置。");
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { totpSecret: true }
  });

  if (!record?.totpSecret) {
    throw new Error("请先开始 TOTP 设置，再验证动态验证码。");
  }

  const verified = await verify({
    secret: record.totpSecret,
    token: normalizeCode(code),
    digits: 6,
    period: 30,
    epochTolerance: 30
  });
  if (!verified.valid) {
    throw new Error("TOTP 验证码不正确。");
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

export async function verifyTotpOrRecovery(
  userId: string,
  code?: string | null,
  recoveryCode?: string | null
): Promise<TotpVerificationResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false };
  }

  const normalizedCode = normalizeCode(code);
  const normalizedRecovery = normalizeCode(recoveryCode).toUpperCase();
  const record = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true }
  });

  if (!record?.totpEnabled || !record.totpSecret) {
    return { ok: false };
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
      return { ok: true, method: "totp" };
    }
  }

  if (!normalizedRecovery) {
    return { ok: false };
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
      return { ok: true, method: "recovery" };
    }
  }

  return { ok: false };
}

export async function sendTotpDisableEmailCode(user: CurrentUser) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, totpEnabled: true }
  });

  if (!record) {
    throw new Error("用户不存在。");
  }

  if (!record.totpEnabled) {
    throw new Error("当前账号未启用 TOTP。");
  }

  const code = generateNumericCode();
  await db.verificationCode.create({
    data: {
      email: record.email.toLowerCase(),
      codeHash: await hashPassword(code),
      type: VerificationCodeType.TOTP_DISABLE,
      expiresAt: new Date(Date.now() + TOTP_DISABLE_CODE_TTL_MINUTES * 60 * 1000)
    }
  });

  const mailResult = await sendTotpDisableCodeMail(record.email, code);
  if (!mailResult.ok) {
    throw new Error(mailResult.message);
  }
}

async function verifyTotpDisableEmailCode(email: string, code?: string | null) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) {
    return false;
  }

  const verificationCode = await db.verificationCode.findFirst({
    where: {
      email: email.toLowerCase(),
      type: VerificationCodeType.TOTP_DISABLE,
      usedAt: null
    },
    orderBy: { createdAt: "desc" }
  });

  if (!verificationCode || verificationCode.expiresAt <= new Date()) {
    return false;
  }

  const matches = await verifyPassword(normalizedCode, verificationCode.codeHash);
  if (!matches) {
    return false;
  }

  await db.verificationCode.update({
    where: { id: verificationCode.id },
    data: { usedAt: new Date() }
  });

  return true;
}

export async function revokeTotpAfterRecoveryLogin(userId: string) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  await db.$transaction([
    db.totpRecoveryCode.deleteMany({ where: { userId } }),
    db.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpConfirmedAt: null,
        totpSecret: null
      }
    })
  ]);
}

export async function disableTotp(
  user: CurrentUser,
  input: {
    method: "totpOrRecovery" | "emailCode";
    currentPassword: string;
    code?: string;
    recoveryCode?: string;
    emailCode?: string;
  }
) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      passwordHash: true,
      totpEnabled: true
    }
  });

  if (!record) {
    throw new Error("用户不存在。");
  }

  if (!record.totpEnabled) {
    throw new Error("当前账号未启用 TOTP。");
  }

  const passwordOk = await verifyPassword(input.currentPassword, record.passwordHash);
  if (!passwordOk) {
    throw new Error("当前密码不正确。");
  }

  if (input.method === "emailCode") {
    const emailCodeOk = await verifyTotpDisableEmailCode(record.email, input.emailCode);
    if (!emailCodeOk) {
      throw new Error("邮箱验证码不正确或已过期。");
    }
  } else {
    const secondFactor = await verifyTotpOrRecovery(user.id, input.code, input.recoveryCode);
    if (!secondFactor.ok) {
      throw new Error("动态验证码或恢复码不正确。");
    }
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
