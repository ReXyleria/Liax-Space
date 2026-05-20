import {
  LoginEventMethod,
  WebAuthnChallengeType,
  UserStatus
} from "@prisma/client";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { db, isDatabaseConfigured } from "@/lib/db";
import { createSession, createTrustedDevice, type CurrentUser } from "@/lib/auth";
import { canAccessConsole } from "@/lib/permissions";
import { sendTemplatedMail } from "@/lib/mail";
import { recordLoginEvent } from "@/features/auth/login-events";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

async function getPasskeyConfig() {
  let origin = process.env.PASSKEY_ORIGIN || "";
  let rpID = process.env.PASSKEY_RP_ID || "";
  let rpName = process.env.PASSKEY_RP_NAME || "";

  if (!origin || !rpID || !rpName) {
    try {
      if (isDatabaseConfigured()) {
        const settings = await db.setting.findMany({
          where: { key: { in: ["passkey.origin", "passkey.rpId", "passkey.rpName"] } }
        });
        const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
        origin = origin || map["passkey.origin"] || "";
        rpID = rpID || map["passkey.rpId"] || "";
        rpName = rpName || map["passkey.rpName"] || "";
      }
    } catch {
      // DB not available, use env-only fallback
    }
  }

  origin = origin || "http://localhost:3000";
  const parsed = new URL(origin);
  rpID = rpID || parsed.hostname || "localhost";
  rpName = rpName || "Liax-Space";

  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("PASSKEY_ORIGIN must be HTTPS in production.");
  }

  return { origin, rpID, rpName };
}

function userIdBytes(userId: string) {
  return new TextEncoder().encode(userId);
}

function encodePublicKey(publicKey: Uint8Array) {
  return Buffer.from(publicKey).toString("base64url");
}

function decodePublicKey(publicKey: string) {
  return new Uint8Array(Buffer.from(publicKey, "base64url"));
}

function parseTransports(value: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is AuthenticatorTransportFuture => typeof item === "string")
      : undefined;
  } catch {
    return undefined;
  }
}

async function storeChallenge(userId: string | null, type: WebAuthnChallengeType, challenge: string) {
  await db.webAuthnChallenge.create({
    data: {
      userId,
      type,
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
    }
  });
}

async function consumeChallenge(userId: string | null, type: WebAuthnChallengeType, challenge: string) {
  const record = await db.webAuthnChallenge.findFirst({
    where: {
      userId,
      type,
      challenge,
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    select: { id: true }
  });

  if (!record) {
    return false;
  }

  await db.webAuthnChallenge.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });
  return true;
}

function resolveSafeRedirect(callbackUrl: string | undefined, user: { role: CurrentUser["role"] }) {
  const fallback = canAccessConsole(user) ? "/console" : "/";

  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return fallback;
  }

  if ((callbackUrl.startsWith("/console") || callbackUrl.startsWith("/admin")) && !canAccessConsole(user)) {
    return "/";
  }

  if (callbackUrl === "/admin" || callbackUrl.startsWith("/admin/")) {
    return callbackUrl.replace(/^\/admin/, "/console");
  }

  return callbackUrl;
}

async function findLoginUser(account: string) {
  const normalized = account.trim().toLowerCase();
  return db.user.findFirst({
    where: { OR: [{ email: normalized }, { username: normalized }] },
    include: {
      passkeys: true
    }
  });
}

export async function generatePasskeyRegistration(user: CurrentUser) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const { rpName, rpID } = await getPasskeyConfig();
  const credentials = await db.passkeyCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true }
  });
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userID: userIdBytes(user.id),
    userDisplayName: user.nickname,
    attestationType: "none",
    excludeCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      transports: parseTransports(credential.transports)
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred"
    }
  });

  await storeChallenge(user.id, WebAuthnChallengeType.REGISTRATION, options.challenge);
  return options;
}

export async function verifyPasskeyRegistration(
  user: CurrentUser,
  response: RegistrationResponseJSON,
  deviceName?: string | null
) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const { origin, rpID } = await getPasskeyConfig();
  const verification = await verifyRegistrationResponse({
    response,
    expectedOrigin: origin,
    expectedRPID: rpID,
    expectedChallenge: (challenge) => consumeChallenge(user.id, WebAuthnChallengeType.REGISTRATION, challenge)
  });

  if (!verification.verified) {
    throw new Error("Passkey registration could not be verified.");
  }

  const info = verification.registrationInfo;
  await db.passkeyCredential.create({
    data: {
      userId: user.id,
      credentialId: info.credential.id,
      publicKey: encodePublicKey(info.credential.publicKey),
      counter: info.credential.counter,
      deviceName: deviceName || "Passkey",
      transports: JSON.stringify(response.response.transports ?? []),
      credentialDeviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp
    }
  });
}

export async function generatePasskeyAuthentication(input: { account?: string; userId?: string } = {}) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  let user = null as Awaited<ReturnType<typeof findLoginUser>> | null;
  const account = input.account?.trim();

  if (input.userId) {
    user = await db.user.findUnique({
      where: { id: input.userId },
      include: { passkeys: true }
    });
  } else if (account) {
    user = await findLoginUser(account);
  }

  if (account || input.userId) {
    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerified || !user.passkeys.length) {
      throw new Error("No passkey is available for this account.");
    }
  }

  const { rpID } = await getPasskeyConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: user
      ? user.passkeys.map((credential) => ({
          id: credential.credentialId,
          transports: parseTransports(credential.transports)
        }))
      : undefined,
    userVerification: "preferred"
  });

  await storeChallenge(user ? user.id : null, WebAuthnChallengeType.AUTHENTICATION, options.challenge);
  return options;
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  meta?: {
    deviceName?: string;
    loginIp?: string;
    callbackUrl?: string;
    cookieSecure?: boolean;
    expectedUserId?: string;
    allowUnboundChallenge?: boolean;
    trustDevice?: boolean;
  }
) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const credential = await db.passkeyCredential.findUnique({
    where: { credentialId: response.id },
    include: { user: true }
  });

  if (!credential || credential.user.status !== UserStatus.ACTIVE || !credential.user.emailVerified) {
    throw new Error("Passkey is not available.");
  }

  if (meta?.expectedUserId && credential.userId !== meta.expectedUserId) {
    throw new Error("Passkey does not match the pending login.");
  }

  const { origin, rpID } = await getPasskeyConfig();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedOrigin: origin,
    expectedRPID: rpID,
    expectedChallenge: async (challenge) => {
      const primaryUserId = meta?.expectedUserId ?? credential.userId;
      if (await consumeChallenge(primaryUserId, WebAuthnChallengeType.AUTHENTICATION, challenge)) {
        return true;
      }
      if (meta?.allowUnboundChallenge) {
        return consumeChallenge(null, WebAuthnChallengeType.AUTHENTICATION, challenge);
      }
      return false;
    },
    credential: {
      id: credential.credentialId,
      publicKey: decodePublicKey(credential.publicKey),
      counter: credential.counter,
      transports: parseTransports(credential.transports)
    }
  });

  if (!verification.verified) {
    throw new Error("Passkey authentication could not be verified.");
  }

  const isNewDevice = meta?.deviceName
    ? !(await db.authSession.findFirst({
        where: {
          userId: credential.userId,
          deviceName: meta.deviceName
        },
        select: { id: true }
      }))
    : false;

  await db.$transaction([
    db.passkeyCredential.update({
      where: { id: credential.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
        credentialDeviceType: verification.authenticationInfo.credentialDeviceType,
        backedUp: verification.authenticationInfo.credentialBackedUp
      }
    }),
    db.user.update({
      where: { id: credential.userId },
      data: { lastLoginAt: new Date() }
    })
  ]);

  await createSession(credential.userId, meta?.deviceName, { secure: meta?.cookieSecure });
  await recordLoginEvent(credential.userId, LoginEventMethod.PASSKEY, meta);
  if (meta?.trustDevice) {
    await createTrustedDevice(credential.userId, meta?.deviceName, { secure: meta.cookieSecure });
  }

  if (isNewDevice) {
    void sendPasskeyLoginNotificationSafely({
      email: credential.user.email,
      nickname: credential.user.nickname,
      loginIp: meta?.loginIp,
      deviceName: meta?.deviceName
    });
  }

  return {
    ok: true,
    message: "Signed in with passkey.",
    redirectTo: resolveSafeRedirect(meta?.callbackUrl, credential.user)
  };
}

async function sendPasskeyLoginNotificationSafely({
  email,
  nickname,
  loginIp,
  deviceName
}: {
  email: string;
  nickname: string;
  loginIp?: string;
  deviceName?: string;
}) {
  try {
    const mailResult = await sendTemplatedMail({
      to: email,
      scene: "loginAlert",
      variables: {
        nickname,
        loginTime: new Date().toLocaleString("zh-CN"),
        loginIp: loginIp ?? "unknown",
        deviceName: deviceName ?? "Unknown device"
      }
    });

    if (!mailResult.ok) {
      console.warn("Skipped passkey login notification", mailResult.message);
    }
  } catch (error) {
    console.warn("Skipped passkey login notification", error);
  }
}
