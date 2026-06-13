import { createHmac, timingSafeEqual } from "node:crypto";

import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { env } from "../config/index.js";
import type { UserRole } from "../users/users.types.js";

export type AuthTokenPurpose = "session" | "totp";

export type AuthTokenPayload = {
  userId: number;
  role: UserRole;
  purpose: AuthTokenPurpose;
  iat: number;
  exp: number;
};

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

const jwtHeader: JwtHeader = {
  alg: "HS256",
  typ: "JWT"
};

const sessionTokenTtlSeconds = 60 * 60 * 24 * 7;
const totpTokenTtlSeconds = 60 * 5;

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function signValue(value: string): string {
  return createHmac("sha256", env.jwtSecret).update(value).digest("base64url");
}

function authenticationError(): AppError {
  return new AppError("Authentication required.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

function parsePayload(payloadPart: string): AuthTokenPayload {
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as Partial<AuthTokenPayload>;

    if (
      !Number.isInteger(payload.userId) ||
      typeof payload.role !== "string" ||
      (payload.purpose !== "session" && payload.purpose !== "totp") ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp)
    ) {
      throw authenticationError();
    }

    return payload as AuthTokenPayload;
  } catch {
    throw authenticationError();
  }
}

function verifySignature(unsignedToken: string, signature: string): void {
  const expectedSignature = signValue(unsignedToken);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw authenticationError();
  }
}

export class JwtService {
  createToken(input: { userId: number; role: UserRole }): string {
    return this.createTokenWithPurpose(input, "session", sessionTokenTtlSeconds);
  }

  createTotpChallengeToken(input: { userId: number; role: UserRole }): string {
    return this.createTokenWithPurpose(input, "totp", totpTokenTtlSeconds);
  }

  verifyToken(token: string): AuthTokenPayload {
    return this.verifyTokenWithPurpose(token, "session");
  }

  verifyTotpChallengeToken(token: string): AuthTokenPayload {
    return this.verifyTokenWithPurpose(token, "totp");
  }

  private createTokenWithPurpose(
    input: { userId: number; role: UserRole },
    purpose: AuthTokenPurpose,
    ttlSeconds: number
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: AuthTokenPayload = {
      userId: input.userId,
      role: input.role,
      purpose,
      iat: now,
      exp: now + ttlSeconds
    };
    const unsignedToken = `${base64UrlJson(jwtHeader)}.${base64UrlJson(payload)}`;
    const signature = signValue(unsignedToken);

    return `${unsignedToken}.${signature}`;
  }

  private verifyTokenWithPurpose(token: string, expectedPurpose: AuthTokenPurpose): AuthTokenPayload {
    const parts = token.split(".");

    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
      throw authenticationError();
    }

    const [headerPart, payloadPart, signature] = parts;
    const unsignedToken = `${headerPart}.${payloadPart}`;

    verifySignature(unsignedToken, signature);

    const payload = parsePayload(payloadPart);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp <= now || payload.purpose !== expectedPurpose) {
      throw authenticationError();
    }

    return payload;
  }
}
