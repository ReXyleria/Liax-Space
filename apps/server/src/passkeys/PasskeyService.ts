import { createHash, createPublicKey, createVerify, randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { JwtService } from "../auth/JwtService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { env } from "../config/index.js";
import { getDatabasePool } from "../database/connection.js";
import { UserRepository } from "../users/UserRepository.js";
import type { User, UserRecord } from "../users/users.types.js";

type PasskeyRow = RowDataPacket & {
  id: number;
  user_id: number;
  credential_id: Buffer | string;
  public_key: string;
  sign_count: number;
  device_name: string | null;
  created_at: Date;
  last_used_at: Date | null;
};

type PasskeyCredentialResponse = {
  id?: string;
  rawId?: string;
  type?: string;
  response?: Record<string, unknown>;
};

type PendingRegistrationChallenge = {
  challenge: string;
  expiresAt: number;
};

type PendingLoginChallenge = {
  challenge: string;
  expiresAt: number;
};

export type Passkey = {
  id: number;
  credentialId: string;
  signCount: number;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

export type PasskeyLoginResult = {
  token: string;
  user: User;
};

const registrationChallenges = new Map<number, PendingRegistrationChallenge>();
const loginChallenges = new Map<string, PendingLoginChallenge>();
const challengeTtlMs = 5 * 60 * 1000;
const rpName = "Liax Space";
const credentialType = "public-key";

function toUser(userRecord: UserRecord): User {
  const { passwordHash: _passwordHash, ...user } = userRecord;

  return user;
}

function getRpId(): string {
  return new URL(env.publicBaseUrl).hostname;
}

function getExpectedOrigin(): string {
  return new URL(env.publicBaseUrl).origin;
}

function createChallenge(): string {
  return randomBytes(32).toString("base64url");
}

function nowMs(): number {
  return Date.now();
}

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function bufferToBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function sha256(value: Buffer | string): Buffer {
  return createHash("sha256").update(value).digest();
}

function badRequest(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function authenticationError(): AppError {
  return new AppError("Authentication required.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

function verificationError(): AppError {
  return new AppError("Passkey verification failed.", {
    code: errorCodes.unauthorized,
    statusCode: 401
  });
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw badRequest("Credential payload is required.");
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  const record = readRecord(value);
  const fieldValue = record[field];

  if (typeof fieldValue !== "string" || !fieldValue.trim()) {
    throw badRequest(`${field} is required.`);
  }

  return fieldValue;
}

function normalizeCredentialId(value: Buffer | string): string {
  return Buffer.isBuffer(value) ? bufferToBase64Url(value) : Buffer.from(value).toString();
}

function mapPasskeyRow(row: PasskeyRow): Passkey {
  return {
    id: row.id,
    credentialId: normalizeCredentialId(row.credential_id),
    signCount: row.sign_count,
    deviceName: row.device_name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at
  };
}

function readCredential(value: unknown): PasskeyCredentialResponse {
  const credential = readRecord(value);
  const response = readRecord(credential.response);

  return {
    id: typeof credential.id === "string" ? credential.id : undefined,
    rawId: typeof credential.rawId === "string" ? credential.rawId : undefined,
    type: typeof credential.type === "string" ? credential.type : undefined,
    response
  };
}

function getCredentialId(credential: PasskeyCredentialResponse): string {
  const credentialId = credential.rawId ?? credential.id;

  if (!credentialId) {
    throw badRequest("credential id is required.");
  }

  return credentialId;
}

function readClientData(response: Record<string, unknown>): Record<string, unknown> {
  const clientDataJSON = readString(response, "clientDataJSON");

  try {
    return JSON.parse(base64UrlToBuffer(clientDataJSON).toString("utf8")) as Record<string, unknown>;
  } catch {
    throw verificationError();
  }
}

function assertClientData(clientData: Record<string, unknown>, expectedType: string, expectedChallenge: string): void {
  if (
    clientData.type !== expectedType ||
    clientData.challenge !== expectedChallenge ||
    clientData.origin !== getExpectedOrigin()
  ) {
    throw verificationError();
  }
}

function assertRpIdHash(authenticatorData: Buffer): void {
  const expectedHash = sha256(getRpId());
  const actualHash = authenticatorData.subarray(0, 32);

  if (actualHash.length !== expectedHash.length || !actualHash.equals(expectedHash)) {
    throw verificationError();
  }
}

function readSignCount(authenticatorData: Buffer): number {
  if (authenticatorData.length < 37) {
    throw verificationError();
  }

  return authenticatorData.readUInt32BE(33);
}

function assertUserPresent(authenticatorData: Buffer): void {
  const flags = authenticatorData[32];

  if ((flags & 0x01) !== 0x01) {
    throw verificationError();
  }
}

type CborReadResult = {
  value: unknown;
  offset: number;
};

function readCborLength(data: Buffer, offset: number, additionalInfo: number): { length: number; offset: number } {
  if (additionalInfo < 24) {
    return { length: additionalInfo, offset };
  }

  if (additionalInfo === 24) {
    return { length: data[offset], offset: offset + 1 };
  }

  if (additionalInfo === 25) {
    return { length: data.readUInt16BE(offset), offset: offset + 2 };
  }

  if (additionalInfo === 26) {
    return { length: data.readUInt32BE(offset), offset: offset + 4 };
  }

  throw verificationError();
}

function readCbor(data: Buffer, startOffset = 0): CborReadResult {
  const initialByte = data[startOffset];
  const majorType = initialByte >> 5;
  const additionalInfo = initialByte & 0x1f;
  const lengthInfo = readCborLength(data, startOffset + 1, additionalInfo);
  let offset = lengthInfo.offset;

  if (majorType === 0) {
    return { value: lengthInfo.length, offset };
  }

  if (majorType === 1) {
    return { value: -1 - lengthInfo.length, offset };
  }

  if (majorType === 2) {
    const value = data.subarray(offset, offset + lengthInfo.length);
    return { value, offset: offset + lengthInfo.length };
  }

  if (majorType === 3) {
    const value = data.subarray(offset, offset + lengthInfo.length).toString("utf8");
    return { value, offset: offset + lengthInfo.length };
  }

  if (majorType === 4) {
    const value: unknown[] = [];

    for (let index = 0; index < lengthInfo.length; index += 1) {
      const item = readCbor(data, offset);
      value.push(item.value);
      offset = item.offset;
    }

    return { value, offset };
  }

  if (majorType === 5) {
    const value = new Map<unknown, unknown>();

    for (let index = 0; index < lengthInfo.length; index += 1) {
      const key = readCbor(data, offset);
      const item = readCbor(data, key.offset);
      value.set(key.value, item.value);
      offset = item.offset;
    }

    return { value, offset };
  }

  throw verificationError();
}

function readMapValue<T>(map: Map<unknown, unknown>, key: unknown): T {
  if (!map.has(key)) {
    throw verificationError();
  }

  return map.get(key) as T;
}

function publicKeyPemFromCose(coseKey: Buffer): string {
  const decoded = readCbor(coseKey).value;

  if (!(decoded instanceof Map)) {
    throw verificationError();
  }

  const kty = readMapValue<number>(decoded, 1);
  const alg = readMapValue<number>(decoded, 3);
  const crv = readMapValue<number>(decoded, -1);
  const x = readMapValue<Buffer>(decoded, -2);
  const y = readMapValue<Buffer>(decoded, -3);

  if (kty !== 2 || alg !== -7 || crv !== 1 || !Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
    throw verificationError();
  }

  return createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: bufferToBase64Url(x),
      y: bufferToBase64Url(y)
    },
    format: "jwk"
  }).export({ type: "spki", format: "pem" }).toString();
}

function parseAttestationObject(attestationObjectValue: string): { credentialId: string; publicKey: string; signCount: number } {
  const attestationObject = readCbor(base64UrlToBuffer(attestationObjectValue)).value;

  if (!(attestationObject instanceof Map)) {
    throw verificationError();
  }

  const authData = readMapValue<Buffer>(attestationObject, "authData");

  if (!Buffer.isBuffer(authData) || authData.length < 55) {
    throw verificationError();
  }

  assertRpIdHash(authData);
  assertUserPresent(authData);

  const flags = authData[32];

  if ((flags & 0x40) !== 0x40) {
    throw verificationError();
  }

  const signCount = readSignCount(authData);
  let offset = 37 + 16;
  const credentialIdLength = authData.readUInt16BE(offset);
  offset += 2;
  const credentialId = authData.subarray(offset, offset + credentialIdLength);
  offset += credentialIdLength;
  const coseKey = authData.subarray(offset);

  return {
    credentialId: bufferToBase64Url(credentialId),
    publicKey: publicKeyPemFromCose(coseKey),
    signCount
  };
}

function parseAuthenticatorData(value: string): Buffer {
  const authenticatorData = base64UrlToBuffer(value);

  if (authenticatorData.length < 37) {
    throw verificationError();
  }

  assertRpIdHash(authenticatorData);
  assertUserPresent(authenticatorData);

  return authenticatorData;
}

function verifyAssertionSignature(input: {
  publicKey: string;
  authenticatorData: Buffer;
  clientDataJSON: string;
  signature: string;
}): void {
  const signedData = Buffer.concat([input.authenticatorData, sha256(base64UrlToBuffer(input.clientDataJSON))]);
  const verifier = createVerify("SHA256");
  verifier.update(signedData);
  verifier.end();

  if (!verifier.verify(input.publicKey, base64UrlToBuffer(input.signature))) {
    throw verificationError();
  }
}

function consumeRegistrationChallenge(userId: number): string {
  const pending = registrationChallenges.get(userId);
  registrationChallenges.delete(userId);

  if (!pending || pending.expiresAt <= nowMs()) {
    throw verificationError();
  }

  return pending.challenge;
}

function consumeLoginChallenge(challenge: string): void {
  const pending = loginChallenges.get(challenge);
  loginChallenges.delete(challenge);

  if (!pending || pending.expiresAt <= nowMs()) {
    throw verificationError();
  }
}

export class PasskeyService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly jwtService = new JwtService()
  ) {}

  async createRegisterOptions(userId: number) {
    const user = await this.requireActiveUser(userId);
    const challenge = createChallenge();
    const existingPasskeys = await this.listPasskeys(userId);

    registrationChallenges.set(userId, {
      challenge,
      expiresAt: nowMs() + challengeTtlMs
    });

    return {
      publicKey: {
        challenge,
        rp: {
          name: rpName,
          id: getRpId()
        },
        user: {
          id: Buffer.from(String(user.id)).toString("base64url"),
          name: user.email,
          displayName: user.username
        },
        pubKeyCredParams: [{ type: credentialType, alg: -7 }],
        timeout: challengeTtlMs,
        attestation: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred"
        },
        excludeCredentials: existingPasskeys.map((passkey) => ({
          id: passkey.credentialId,
          type: credentialType
        }))
      }
    };
  }

  async verifyRegistration(userId: number, input: { credential: unknown; deviceName?: string | null }): Promise<Passkey> {
    await this.requireActiveUser(userId);
    const credential = readCredential(input.credential);
    const response = readRecord(credential.response);
    const clientData = readClientData(response);
    const expectedChallenge = consumeRegistrationChallenge(userId);

    if (credential.type !== credentialType) {
      throw verificationError();
    }

    assertClientData(clientData, "webauthn.create", expectedChallenge);

    const attestationObject = readString(response, "attestationObject");
    const parsedAttestation = parseAttestationObject(attestationObject);
    const credentialId = getCredentialId(credential);

    if (credentialId !== parsedAttestation.credentialId) {
      throw verificationError();
    }

    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO user_passkeys (user_id, credential_id, public_key, sign_count, device_name) VALUES (?, ?, ?, ?, ?)",
      [userId, credentialId, parsedAttestation.publicKey, parsedAttestation.signCount, input.deviceName ?? null]
    );

    return this.requirePasskeyById(result.insertId, userId);
  }

  async createLoginOptions(input: { email?: string | null }) {
    const challenge = createChallenge();
    const allowCredentials = input.email ? await this.listCredentialOptionsForEmail(input.email) : [];

    loginChallenges.set(challenge, {
      challenge,
      expiresAt: nowMs() + challengeTtlMs
    });

    return {
      publicKey: {
        challenge,
        rpId: getRpId(),
        timeout: challengeTtlMs,
        userVerification: "preferred",
        allowCredentials
      }
    };
  }

  async verifyLogin(input: { credential: unknown }): Promise<PasskeyLoginResult> {
    const credential = readCredential(input.credential);
    const response = readRecord(credential.response);
    const clientData = readClientData(response);
    const credentialId = getCredentialId(credential);

    if (credential.type !== credentialType || typeof clientData.challenge !== "string") {
      throw verificationError();
    }

    consumeLoginChallenge(clientData.challenge);
    assertClientData(clientData, "webauthn.get", clientData.challenge);

    const passkeyRow = await this.findPasskeyRowByCredentialId(credentialId);

    if (!passkeyRow) {
      throw verificationError();
    }

    const user = await this.requireActiveUser(passkeyRow.user_id);
    const authenticatorData = parseAuthenticatorData(readString(response, "authenticatorData"));
    const nextSignCount = readSignCount(authenticatorData);

    verifyAssertionSignature({
      publicKey: passkeyRow.public_key,
      authenticatorData,
      clientDataJSON: readString(response, "clientDataJSON"),
      signature: readString(response, "signature")
    });

    if (passkeyRow.sign_count > 0 && nextSignCount <= passkeyRow.sign_count) {
      throw verificationError();
    }

    const pool = getDatabasePool();
    await pool.execute("UPDATE user_passkeys SET sign_count = ?, last_used_at = ? WHERE id = ?", [
      nextSignCount,
      new Date(),
      passkeyRow.id
    ]);
    await this.userRepository.updateLastLoginAt(user.id);

    return {
      token: this.jwtService.createToken({
        userId: user.id,
        role: user.role
      }),
      user: toUser(user)
    };
  }

  async listPasskeys(userId: number): Promise<Passkey[]> {
    await this.requireActiveUser(userId);
    const pool = getDatabasePool();
    const [rows] = await pool.execute<PasskeyRow[]>(
      "SELECT id, user_id, credential_id, public_key, sign_count, device_name, created_at, last_used_at FROM user_passkeys WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    return rows.map(mapPasskeyRow);
  }

  async deletePasskey(userId: number, passkeyId: number): Promise<{ deleted: true }> {
    await this.requireActiveUser(userId);
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM user_passkeys WHERE id = ? AND user_id = ?", [
      passkeyId,
      userId
    ]);

    if (result.affectedRows === 0) {
      throw new AppError("Passkey not found.", {
        code: errorCodes.notFound,
        statusCode: 404
      });
    }

    return { deleted: true };
  }

  private async listCredentialOptionsForEmail(email: string) {
    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());

    if (!user || user.disabledAt) {
      return [];
    }

    const passkeys = await this.listPasskeys(user.id);

    return passkeys.map((passkey) => ({
      id: passkey.credentialId,
      type: credentialType
    }));
  }

  private async requirePasskeyById(passkeyId: number, userId: number): Promise<Passkey> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<PasskeyRow[]>(
      "SELECT id, user_id, credential_id, public_key, sign_count, device_name, created_at, last_used_at FROM user_passkeys WHERE id = ? AND user_id = ? LIMIT 1",
      [passkeyId, userId]
    );

    if (!rows[0]) {
      throw new Error("Created passkey could not be loaded.");
    }

    return mapPasskeyRow(rows[0]);
  }

  private async findPasskeyRowByCredentialId(credentialId: string): Promise<PasskeyRow | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<PasskeyRow[]>(
      "SELECT id, user_id, credential_id, public_key, sign_count, device_name, created_at, last_used_at FROM user_passkeys WHERE credential_id = ? LIMIT 1",
      [credentialId]
    );

    return rows[0] ?? null;
  }

  private async requireActiveUser(userId: number): Promise<UserRecord> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.disabledAt) {
      throw authenticationError();
    }

    return user;
  }
}
