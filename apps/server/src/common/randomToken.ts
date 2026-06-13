import { randomBytes, timingSafeEqual } from "node:crypto";

export function generateRandomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function safeCompareToken(inputToken: string, expectedToken: string): boolean {
  const inputBuffer = Buffer.from(inputToken);
  const expectedBuffer = Buffer.from(expectedToken);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}
