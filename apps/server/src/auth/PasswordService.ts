import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const algorithm = "scrypt";
const saltBytes = 16;
const keyBytes = 64;

function parsePasswordHash(passwordHash: string) {
  const parts = passwordHash.split("$");

  if (parts.length !== 3) {
    return null;
  }

  const [storedAlgorithm, saltHex, derivedKeyHex] = parts;

  if (storedAlgorithm !== algorithm || !saltHex || !derivedKeyHex) {
    return null;
  }

  const salt = Buffer.from(saltHex, "hex");
  const derivedKey = Buffer.from(derivedKeyHex, "hex");

  if (salt.length !== saltBytes || derivedKey.length !== keyBytes) {
    return null;
  }

  return { salt, derivedKey };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(saltBytes);
  const derivedKey = (await scrypt(password, salt, keyBytes)) as Buffer;

  return `${algorithm}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parsedHash = parsePasswordHash(passwordHash);

  if (!parsedHash) {
    return false;
  }

  const derivedKey = (await scrypt(password, parsedHash.salt, parsedHash.derivedKey.length)) as Buffer;

  if (derivedKey.length !== parsedHash.derivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, parsedHash.derivedKey);
}
