import { createHash } from "node:crypto";

// Content and file hashing only. Passwords must use PasswordService.
export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
