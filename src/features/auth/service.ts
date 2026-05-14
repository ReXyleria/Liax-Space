import { UserRole, UserStatus, VerificationCodeType } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { clearSession, createSession, createTrustedDevice, resolveTrustedDevice } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";
import { sendTemplatedMail, sendVerificationCodeMail } from "@/lib/mail";
import { generateNumericCode, generateOpaqueToken, hashPassword, hashToken, verifyPassword } from "@/lib/security";
import { verifyTotpOrRecovery } from "@/features/account/totp-service";
import { emailSchema, loginSchema, loginSecondFactorSchema, registerSchema } from "@/features/auth/validators";
import type { AuthResponse } from "@/features/auth/types";

const REGISTER_CODE_TTL_MINUTES = 10;
const PENDING_LOGIN_TTL_MINUTES = 10;

const highPrivilegePermissions = new Set([
  "users.manage",
  "settings.manage",
  "identities.manage",
  "backupRestore.manage",
  "mailTemplates.manage",
  "codeInjection.manage"
]);
const highPrivilegeRoles: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR];

function parsePublicRole(value: string | undefined | null): UserRole {
  if (value === "FRIEND" || value === "VIP") {
    return value;
  }

  return UserRole.USER;
}

function resolveSafeRedirect(callbackUrl: string | undefined, user: { role: UserRole }) {
  const fallback = canAccessAdmin(user) ? "/admin" : "/";

  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return fallback;
  }

  if (callbackUrl.startsWith("/admin") && !canAccessAdmin(user)) {
    return "/";
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

function isHighPrivilegeIdentity(identity: { builtInRole: UserRole | null; permissions: unknown }) {
  if (identity.builtInRole && highPrivilegeRoles.includes(identity.builtInRole)) {
    return true;
  }

  if (!Array.isArray(identity.permissions)) {
    return false;
  }

  return identity.permissions.some(
    (permission) => typeof permission === "string" && highPrivilegePermissions.has(permission)
  );
}

function buildSecondFactorMethods(user: { totpEnabled: boolean; passkeys: Array<{ id: string }> }) {
  const methods: Array<"totp" | "passkey"> = [];
  if (user.totpEnabled) {
    methods.push("totp");
  }
  if (user.passkeys.length) {
    methods.push("passkey");
  }
  return methods;
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
  meta: { deviceName?: string; loginIp?: string } | undefined,
  callbackUrl: string | undefined,
  options?: { trustDevice?: boolean }
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

  await createSession(user.id, meta?.deviceName);

  if (options?.trustDevice) {
    await createTrustedDevice(user.id, meta?.deviceName);
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

export async function loginUser(input: unknown, meta?: { deviceName?: string; loginIp?: string }): Promise<AuthResponse> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "用户名、邮箱或密码不正确。" };
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
    const genericFailure = { ok: false, message: "用户名、邮箱或密码不正确。" };

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
    const secondFactorMethods = buildSecondFactorMethods(user);
    if (secondFactorMethods.length) {
      const trustedDevice = await resolveTrustedDevice(user.id);
      if (!trustedDevice) {
        const pendingToken = await createPendingLogin(user.id);
        return {
          ok: false,
          requiresSecondFactor: true,
          pendingToken,
          secondFactors: secondFactorMethods,
          message: "当前设备需要二次验证。"
        };
      }
    }

    return await finalizeLogin(user, meta, parsed.data.callbackUrl);
  } catch (error) {
    console.error("Failed to login", error);
    return { ok: false, message: "Login failed." };
  }
}

export async function verifyLoginSecondFactor(
  input: unknown,
  meta?: { deviceName?: string; loginIp?: string }
): Promise<AuthResponse> {
  const parsed = loginSecondFactorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "二次验证数据无效。" };
  }

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not configured." };
  }

  try {
    const pending = await getPendingLogin(parsed.data.pendingToken);
    if (!pending) {
      return { ok: false, message: "二次验证已过期，请重新登录。" };
    }

    const { user } = pending;

    if (user.status !== UserStatus.ACTIVE) {
      return { ok: false, message: "This account is disabled." };
    }

    if (!user.emailVerified) {
      return { ok: false, message: "Email is not verified yet." };
    }

    if (!user.totpEnabled) {
      return { ok: false, message: "请使用通行密钥完成二次验证。" };
    }

    const secondFactorOk = await verifyTotpOrRecovery(
      user.id,
      parsed.data.totpCode,
      parsed.data.recoveryCode
    );

    if (!secondFactorOk) {
      return {
        ok: false,
        message: parsed.data.totpCode || parsed.data.recoveryCode
          ? "二次验证码错误。"
          : "需要输入二次验证码。"
      };
    }

    await clearPendingLogin(parsed.data.pendingToken);
    return await finalizeLogin(user, meta, parsed.data.callbackUrl, { trustDevice: parsed.data.trustDevice });
  } catch (error) {
    console.error("Failed to verify second factor", error);
    return { ok: false, message: "二次验证失败。" };
  }
}

export async function logoutUser(): Promise<AuthResponse> {
  await clearSession();
  return { ok: true, message: "Signed out." };
}
