import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";

import { JwtService, type AuthTokenPayload } from "../auth/JwtService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { env } from "../config/index.js";
import { getDatabasePool } from "../database/connection.js";
import { UserRepository } from "../users/UserRepository.js";
import type { User, UserRecord } from "../users/users.types.js";

type TotpRow = RowDataPacket & {
  user_id: number;
  secret_encrypted: string;
  enabled: number | boolean;
  confirmed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type TotpSetupResult = {
  secret: string;
  otpauthUrl: string;
};

export type TotpLoginInput = {
  totpToken: string;
  code: string;
};

export type TotpLoginResult = {
  token: string;
  user: User;
};

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const totpDigits = 6;
const totpPeriodSeconds = 30;
const totpWindow = 1;
const encryptionVersion = "v1";

function toUser(userRecord: UserRecord): User {
  const { passwordHash: _passwordHash, ...user } = userRecord;

  return user;
}

function getEncryptionKey(): Buffer {
  return createHash("sha256").update(env.jwtSecret).digest();
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [encryptionVersion, iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(
    "."
  );
}

function decryptSecret(encryptedSecret: string): string {
  const [version, ivValue, authTagValue, ciphertextValue] = encryptedSecret.split(".");

  if (version !== encryptionVersion || !ivValue || !authTagValue || !ciphertextValue) {
    throw new AppError("TOTP secret could not be read.", {
      code: errorCodes.internalServerError,
      statusCode: 500,
      expose: false
    });
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}

function base32Encode(buffer: Buffer): string {
  let output = "";
  let value = 0;
  let bits = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += base32Alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(value: string): Buffer {
  const cleanValue = value.replace(/[=\s]/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let buffer = 0;

  for (const char of cleanValue) {
    const index = base32Alphabet.indexOf(char);

    if (index < 0) {
      throw new AppError("TOTP secret could not be read.", {
        code: errorCodes.internalServerError,
        statusCode: 500,
        expose: false
      });
    }

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function createCounterBuffer(counter: number): Buffer {
  const buffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;

  buffer.writeUInt32BE(high, 0);
  buffer.writeUInt32BE(low, 4);

  return buffer;
}

function generateTotpCode(secret: string, counter: number): string {
  const hmac = createHmac("sha1", base32Decode(secret)).update(createCounterBuffer(counter)).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode = hmac.readUInt32BE(offset) & 0x7fffffff;

  return String(binaryCode % 10 ** totpDigits).padStart(totpDigits, "0");
}

function safeCompareCode(inputCode: string, expectedCode: string): boolean {
  const inputBuffer = Buffer.from(inputCode);
  const expectedBuffer = Buffer.from(expectedCode);

  return inputBuffer.length === expectedBuffer.length && timingSafeEqual(inputBuffer, expectedBuffer);
}

function verifyTotpCode(secret: string, code: string): boolean {
  const cleanCode = code.replace(/\s/g, "");

  if (!/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  const currentCounter = Math.floor(Date.now() / 1000 / totpPeriodSeconds);

  for (let offset = -totpWindow; offset <= totpWindow; offset += 1) {
    if (safeCompareCode(cleanCode, generateTotpCode(secret, currentCounter + offset))) {
      return true;
    }
  }

  return false;
}

function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function createOtpAuthUrl(user: UserRecord, secret: string): string {
  const issuer = "Liax Space";
  const label = `${issuer}:${user.email}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(totpDigits),
    period: String(totpPeriodSeconds)
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function authenticationError(): AppError {
  return new AppError("Authentication required.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

function verificationFailedError(): AppError {
  return new AppError("Invalid verification code.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

export class TotpService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly jwtService = new JwtService()
  ) {}

  async isTotpEnabled(userId: number): Promise<boolean> {
    const row = await this.findTotpRow(userId);

    return row ? Boolean(row.enabled) : false;
  }

  async setup(userId: number): Promise<TotpSetupResult> {
    const user = await this.requireActiveUser(userId);
    const secret = generateSecret();
    const encryptedSecret = encryptSecret(secret);
    const pool = getDatabasePool();

    await pool.execute(
      `INSERT INTO user_totp (user_id, secret_encrypted, enabled, confirmed_at)
       VALUES (?, ?, FALSE, NULL)
       ON DUPLICATE KEY UPDATE
         secret_encrypted = VALUES(secret_encrypted),
         enabled = FALSE,
         confirmed_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, encryptedSecret]
    );

    return {
      secret,
      otpauthUrl: createOtpAuthUrl(user, secret)
    };
  }

  async confirm(userId: number, code: string): Promise<{ enabled: true }> {
    await this.requireActiveUser(userId);
    const totp = await this.requireTotpRow(userId);
    const secret = decryptSecret(totp.secret_encrypted);

    if (!verifyTotpCode(secret, code)) {
      throw verificationFailedError();
    }

    const pool = getDatabasePool();
    await pool.execute("UPDATE user_totp SET enabled = TRUE, confirmed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", [
      new Date(),
      userId
    ]);

    return { enabled: true };
  }

  async disable(userId: number): Promise<{ enabled: false }> {
    await this.requireActiveUser(userId);
    const pool = getDatabasePool();

    await pool.execute("DELETE FROM user_totp WHERE user_id = ?", [userId]);

    return { enabled: false };
  }

  async loginWithTotp(input: TotpLoginInput): Promise<TotpLoginResult> {
    if (!input.totpToken || !input.code) {
      throw verificationFailedError();
    }

    let challenge: AuthTokenPayload;

    try {
      challenge = this.jwtService.verifyTotpChallengeToken(input.totpToken);
    } catch {
      throw verificationFailedError();
    }

    const userRecord = await this.userRepository.findById(challenge.userId);

    if (!userRecord || userRecord.disabledAt) {
      throw verificationFailedError();
    }

    const totp = await this.requireTotpRow(challenge.userId);

    if (!totp.enabled || !verifyTotpCode(decryptSecret(totp.secret_encrypted), input.code)) {
      throw verificationFailedError();
    }

    const updatedUserRecord = await this.userRepository.updateLastLoginAt(userRecord.id);
    const user = toUser(updatedUserRecord ?? userRecord);
    const token = this.jwtService.createToken({
      userId: user.id,
      role: user.role
    });

    return { token, user };
  }

  private async findTotpRow(userId: number): Promise<TotpRow | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<TotpRow[]>(
      "SELECT user_id, secret_encrypted, enabled, confirmed_at, created_at, updated_at FROM user_totp WHERE user_id = ? LIMIT 1",
      [userId]
    );

    return rows[0] ?? null;
  }

  private async requireTotpRow(userId: number): Promise<TotpRow> {
    const row = await this.findTotpRow(userId);

    if (!row) {
      throw verificationFailedError();
    }

    return row;
  }

  private async requireActiveUser(userId: number): Promise<UserRecord> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.disabledAt) {
      throw authenticationError();
    }

    return user;
  }
}
