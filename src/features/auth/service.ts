import { LoginEventMethod, UserRole, UserStatus, VerificationCodeType } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { clearSession, createSession, createTrustedDevice, resolveTrustedDevice } from "@/lib/auth";
import { canAccessConsole } from "@/lib/permissions";
import { sendLoginCodeMail, sendTemplatedMail, sendVerificationCodeMail } from "@/lib/mail";
import { generateNumericCode, generateOpaqueToken, hashPassword, hashToken, verifyPassword } from "@/lib/security";
import { revokeTotpAfterRecoveryLogin, verifyTotpOrRecovery } from "@/features/account/totp-service";
import { recordLoginEvent } from "@/features/auth/login-events";
import { emailSchema, loginSchema, loginSecondFactorSchema, registerSchema } from "@/features/auth/validators";
import type { AuthResponse } from "@/features/auth/types";
import { isHighPrivilegeIdentity } from "@/lib/permission-definitions";

const REGISTER_CODE_TTL_MINUTES = 10;
const LOGIN_CODE_TTL_MINUTES = 10;
const PENDING_LOGIN_TTL_MINUTES = 10;

function parsePublicRole(value: string | undefined | null): UserRole {
  if (value === "SVIP" || value === "SSVIP") {
    return value;
  }

  return UserRole.USER;
}

function resolveSafeRedirect(callbackUrl: string | undefined, user: { role: UserRole }) {
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

async function getBooleanSetting(key: string, fallback: boolean) {
  if (!isDatabaseConfigured()) {
    return fallback;
  }

  return withDatabase(async () => {
    const setting = await db.setting.findUnique({ where: { key } });
    return setting ? setting.value === "true" : fallback;
  }, fallback);
}

async function getTextSetting(key: string, fallback = "") {
  if (!isDatabaseConfigured()) {
    return fallback;
  }

  return withDatabase(async () => {
    const setting = await db.setting.findUnique({ where: { key } });
    return setting?.value ?? fallback;
  }, fallback);
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function buildBackupSecondFactorMethods(user: { totpEnabled: boolean; passkeys: Array<{ id: string }> }) {
  const methods: Array<"totp" | "passkey"> = [];
  if (user.totpEnabled) {
    methods.push("totp");
  }
  if (user.passkeys.length) {
    methods.push("passkey");
  }
  return methods;
}

async function sendLoginCode(user: { email: string; nickname: string }) {
  const code = generateNumericCode();
  await db.verificationCode.create({
    data: {
      email: user.email.toLowerCase(),
      codeHash: await hashPassword(code),
      type: VerificationCodeType.LOGIN,
      expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MINUTES * 60 * 1000)
    }
  });

  const mailResult = await sendLoginCodeMail(user.email, code);
  if (!mailResult.ok) {
    throw new Error(mailResult.message);
  }
}

async function verifyLoginCode(email: string, code?: string | null) {
  const normalizedCode = code?.trim();
  if (!normalizedCode) {
    return false;
  }

  const verificationCode = await db.verificationCode.findFirst({
    where: {
      email: email.toLowerCase(),
      type: VerificationCodeType.LOGIN,
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

async function createPendingLogin(userId: string) {
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PENDING_LOGIN_TTL_MINUTES * 60 * 1000);

  await db.pendingAuth.deleteMany({ where: { userId } });
  await db.pendingAuth.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  return token;
}

export async function getPendingLogin(token: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return db.pendingAuth.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: { gt: new Date() }
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          nickname: true,
          role: true,
          status: true,
          emailVerified: true,
          totpEnabled: true,
          passkeys: { select: { id: true } }
        }
      }
    }
  });
}

export async function clearPendingLogin(token: string) {
  if (!isDatabaseConfigured()) {
    return;
  }

  await db.pendingAuth.deleteMany({
    where: { tokenHash: hashToken(token) }
  });
}

async function finalizeLogin(
  user: { id: string; email: string; nickname: string; role: UserRole },
  meta: { deviceName?: string; loginIp?: string; cookieSecure?: boolean } | undefined,
  callbackUrl: string | undefined,
  options?: { trustDevice?: boolean; method?: LoginEventMethod }
): Promise<AuthResponse> {
  const isNewDevice = meta?.deviceName
    ? !(await db.authSession.findFirst({
        where: {
          userId: user.id,
          deviceName: meta.deviceName
        },
        select: { id: true }
      }))
    : false;

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  await createSession(user.id, meta?.deviceName, { secure: meta?.cookieSecure });
  await recordLoginEvent(user.id, options?.method ?? LoginEventMethod.PASSWORD, meta);

  if (options?.trustDevice) {
    await createTrustedDevice(user.id, meta?.deviceName, { secure: meta?.cookieSecure });
  }

  if (isNewDevice) {
    void sendLoginNotificationSafely(user, meta, "password");
  }

  return {
    ok: true,
    message: "Signed in.",
    redirectTo: resolveSafeRedirect(callbackUrl, user)
  };
}

async function sendLoginNotificationSafely(
  user: { email: string; nickname: string },
  meta: { deviceName?: string; loginIp?: string } | undefined,
  method: "password" | "passkey"
) {
  try {
    const mailResult = await sendTemplatedMail({
      to: user.email,
      scene: "loginAlert",
      variables: {
        nickname: user.nickname,
        loginTime: new Date().toLocaleString("zh-CN"),
        loginIp: meta?.loginIp ?? "unknown",
        deviceName: meta?.deviceName ?? "Unknown device"
      }
    });

    if (!mailResult.ok) {
      console.warn(`Skipped ${method} login notification`, mailResult.message);
    }
  } catch (error) {
    console.warn(`Skipped ${method} login notification`, error);
  }
}

async function sendTotpRecoveryUsedNotificationSafely(
  user: { email: string; nickname: string },
  meta: { deviceName?: string; loginIp?: string } | undefined
) {
  try {
    const mailResult = await sendTemplatedMail({
      to: user.email,
      scene: "totpRecoveryUsed",
      variables: {
        nickname: user.nickname,
        loginTime: new Date().toLocaleString("zh-CN"),
        loginIp: meta?.loginIp ?? "unknown",
        deviceName: meta?.deviceName ?? "Unknown device"
      },
      respectNotificationToggle: false
    });

    if (!mailResult.ok) {
      console.warn("Skipped TOTP recovery-used notification", mailResult.message);
    }
  } catch (error) {
    console.warn("Skipped TOTP recovery-used notification", error);
  }
}

export async function sendRegisterCode(input: unknown): Promise<AuthResponse> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Email is invalid." };
  }

  const registrationEnabled = await getBooleanSetting("register.enabled", true);
  if (!registrationEnabled) {
    return { ok: false, message: "Registration is currently disabled." };
  }

  const email = parsed.data.email.toLowerCase();

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not configured." };
  }

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, message: "This email is already registered." };
    }

    const code = generateNumericCode();
    await db.verificationCode.create({
      data: {
        email,
        codeHash: await hashPassword(code),
        type: VerificationCodeType.REGISTER,
        expiresAt: new Date(Date.now() + REGISTER_CODE_TTL_MINUTES * 60 * 1000)
      }
    });

    const mailResult = await sendVerificationCodeMail(email, code);
    if (!mailResult.ok) {
      return { ok: false, message: mailResult.message };
    }

    return { ok: true, message: "Verification code sent." };
  } catch (error) {
    console.error("Failed to send register code", error);
    return { ok: false, message: "Failed to send verification code." };
  }
}

export async function registerUser(input: unknown): Promise<AuthResponse> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Registration data is invalid." };
  }

  const registrationEnabled = await getBooleanSetting("register.enabled", true);
  if (!registrationEnabled) {
    return { ok: false, message: "Registration is currently disabled." };
  }

  const email = parsed.data.email.toLowerCase();
  const username = normalizeUsername(parsed.data.username);

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not configured." };
  }

  try {
    const existing = await db.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });
    if (existing?.email === email) {
      return { ok: false, message: "This email is already registered." };
    }
    if (existing?.username === username) {
      return { ok: false, message: "This username is already taken." };
    }

    const verificationCode = await db.verificationCode.findFirst({
      where: {
        email,
        type: VerificationCodeType.REGISTER
      },
      orderBy: { createdAt: "desc" }
    });

    if (!verificationCode) {
      return { ok: false, message: "Request an email verification code first." };
    }
    if (verificationCode.usedAt) {
      return { ok: false, message: "Verification code has already been used." };
    }
    if (verificationCode.expiresAt <= new Date()) {
      return { ok: false, message: "Verification code has expired." };
    }

    const codeMatches = await verifyPassword(parsed.data.emailCode, verificationCode.codeHash);
    if (!codeMatches) {
      return { ok: false, message: "Verification code is incorrect." };
    }

    const defaultRole = parsePublicRole(await getTextSetting("register.defaultRole", "USER"));
    const defaultIdentityId = await getTextSetting("register.defaultIdentityId", "");
    const identity = defaultIdentityId
      ? await db.identity.findUnique({
          where: { id: defaultIdentityId },
          select: { id: true, builtInRole: true, permissions: true }
        })
      : null;
    const canUseIdentity = identity ? !isHighPrivilegeIdentity(identity) : false;
    const identityRole = canUseIdentity ? identity?.builtInRole : null;

    await db.$transaction([
      db.user.create({
        data: {
          email,
          username,
          nickname: parsed.data.nickname,
          passwordHash: await hashPassword(parsed.data.password),
          role: identityRole ?? defaultRole,
          identityId: canUseIdentity ? identity?.id ?? null : null,
          status: UserStatus.ACTIVE,
          emailVerified: true
        }
      }),
      db.verificationCode.update({
        where: { id: verificationCode.id },
        data: { usedAt: new Date() }
      })
    ]);

    return { ok: true, message: "Registration complete. You can now sign in." };
  } catch (error) {
    console.error("Failed to register user", error);
    return { ok: false, message: "Registration failed." };
  }
}

export async function loginUser(
  input: unknown,
  meta?: { deviceName?: string; loginIp?: string; cookieSecure?: boolean }
): Promise<AuthResponse> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Username, email, or password is incorrect." };
  }

  const account = parsed.data.account.toLowerCase();

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not configured." };
  }

  try {
    const user = await db.user.findFirst({
      where: { OR: [{ email: account }, { username: account }] },
      include: {
        passkeys: { select: { id: true } }
      }
    });
    const genericFailure = { ok: false, message: "Username, email, or password is incorrect." };

    if (!user) {
      return genericFailure;
    }

    const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordMatches) {
      return genericFailure;
    }

    if (user.status !== UserStatus.ACTIVE) {
      return { ok: false, message: "This account is disabled." };
    }

    if (!user.emailVerified) {
      return { ok: false, message: "Email is not verified yet." };
    }

    const trustedDevice = await resolveTrustedDevice(user.id);
    if (!trustedDevice) {
      const backupMethods = buildBackupSecondFactorMethods(user);
      const pendingToken = await createPendingLogin(user.id);
      try {
        await sendLoginCode(user);
        return {
          ok: false,
          requiresSecondFactor: true,
          pendingToken,
          secondFactors: ["email", ...backupMethods],
          message: "This device requires second-factor verification. An email code was sent."
        };
      } catch (error) {
        if (!backupMethods.length) {
          await clearPendingLogin(pendingToken);
          const result = await finalizeLogin(user, meta, parsed.data.callbackUrl, {
            method: LoginEventMethod.SMTP_FAIL_OPEN
          });
          return {
            ...result,
            message: error instanceof Error
              ? `SMTP is unavailable, so email second-factor verification was skipped and sign-in completed: ${error.message}`
              : "SMTP is unavailable, so email second-factor verification was skipped and sign-in completed."
          };
        }

        return {
          ok: false,
          requiresSecondFactor: true,
          pendingToken,
          secondFactors: backupMethods,
          message: error instanceof Error
            ? `Email verification code failed. Use a backup verification method: ${error.message}`
            : "Email verification code failed. Use a backup verification method."
        };
      }
    }

    return await finalizeLogin(user, meta, parsed.data.callbackUrl, { method: LoginEventMethod.PASSWORD });
  } catch (error) {
    console.error("Failed to login", error);
    return { ok: false, message: "Login failed." };
  }
}

export async function verifyLoginSecondFactor(
  input: unknown,
  meta?: { deviceName?: string; loginIp?: string; cookieSecure?: boolean }
): Promise<AuthResponse> {
  const parsed = loginSecondFactorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Second-factor data is invalid." };
  }

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not configured." };
  }

  try {
    const pending = await getPendingLogin(parsed.data.pendingToken);
    if (!pending) {
      return { ok: false, message: "Second-factor verification expired. Sign in again." };
    }

    const { user } = pending;

    if (user.status !== UserStatus.ACTIVE) {
      return { ok: false, message: "This account is disabled." };
    }

    if (!user.emailVerified) {
      return { ok: false, message: "Email is not verified yet." };
    }

    const emailOk = await verifyLoginCode(user.email, parsed.data.emailCode);
    const totpResult = user.totpEnabled
      ? await verifyTotpOrRecovery(user.id, parsed.data.totpCode, parsed.data.recoveryCode)
      : { ok: false as const };
    const secondFactorOk = emailOk || totpResult.ok;

    if (!secondFactorOk) {
      return {
        ok: false,
        message: parsed.data.emailCode || parsed.data.totpCode || parsed.data.recoveryCode
          ? "Second-factor code is incorrect."
          : "Enter an email code, TOTP code, or recovery code."
      };
    }

    await clearPendingLogin(parsed.data.pendingToken);
    if (totpResult.ok && totpResult.method === "recovery") {
      await revokeTotpAfterRecoveryLogin(user.id);
      void sendTotpRecoveryUsedNotificationSafely(user, meta);
    }

    const method = totpResult.ok
      ? totpResult.method === "recovery"
        ? LoginEventMethod.RECOVERY
        : LoginEventMethod.TOTP
      : LoginEventMethod.EMAIL_CODE;

    return await finalizeLogin(user, meta, parsed.data.callbackUrl, {
      trustDevice: parsed.data.trustDevice,
      method
    });
  } catch (error) {
    console.error("Failed to verify second factor", error);
    return { ok: false, message: "Second-factor verification failed." };
  }
}

export async function logoutUser(): Promise<AuthResponse> {
  await clearSession();
  return { ok: true, message: "Signed out." };
}
