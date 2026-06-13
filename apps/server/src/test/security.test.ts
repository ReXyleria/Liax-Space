import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import type { Attachment, CreateAttachmentInput, UploadedAttachmentFile } from "../attachments/attachments.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { logger } from "../common/logger.js";
import { sanitizeHtml } from "../renderer/HtmlSanitizer.js";

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

let tempRoot = "";

class MemoryAttachmentRepository {
  private nextId = 1;
  readonly attachments: Attachment[] = [];

  async createAttachment(input: CreateAttachmentInput): Promise<Attachment> {
    const attachment: Attachment = {
      createdAt: new Date(),
      deletedAt: null,
      id: this.nextId,
      mimeType: input.mimeType,
      originalFilename: input.originalFilename,
      ownerId: input.ownerId,
      publicUrl: input.publicUrl ?? null,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey
    };

    this.nextId += 1;
    this.attachments.push(attachment);
    return attachment;
  }
}

function setTestEnvironment(root: string): void {
  process.env.APP_ENV = "test";
  process.env.APP_PORT = "3100";
  process.env.DATABASE_HOST = "127.0.0.1";
  process.env.DATABASE_PORT = "3306";
  process.env.DATABASE_NAME = "liax_test";
  process.env.DATABASE_USER = "liax_test";
  process.env.DATABASE_PASSWORD = "liax_test";
  process.env.JWT_SECRET = "security-test-jwt-secret";
  process.env.PASSWORD_PEPPER = "security-test-pepper";
  process.env.PUBLIC_BASE_URL = "https://example.test";
  process.env.STORAGE_UPLOADS_DIR = path.join(root, "uploads");
  process.env.STORAGE_RENDERED_DIR = path.join(root, "rendered");
  process.env.STORAGE_RUNTIME_DIR = path.join(root, "runtime");
}

function uploadFile(input: Partial<UploadedAttachmentFile> = {}): UploadedAttachmentFile {
  const buffer = input.buffer ?? pngBytes;

  return {
    buffer,
    filename: input.filename ?? "image.png",
    mimeType: input.mimeType ?? "image/png",
    sizeBytes: input.sizeBytes ?? buffer.length
  };
}

function assertValidationError(error: unknown): boolean {
  assert.ok(error instanceof AppError);
  assert.equal(error.code, errorCodes.validationFailed);
  return true;
}

async function createAttachmentService(repository: MemoryAttachmentRepository) {
  const { AttachmentService } = await import("../attachments/AttachmentService.js");

  return new AttachmentService(repository as never);
}

function captureInfoLog(fields: Record<string, unknown>): string {
  const originalLog = console.log;
  const lines: string[] = [];

  console.log = (line?: unknown) => {
    lines.push(String(line));
  };

  try {
    logger.info("security event", fields);
  } finally {
    console.log = originalLog;
  }

  return lines.join("\n");
}

before(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "liax-security-test-"));
  await Promise.all([
    mkdir(path.join(tempRoot, "uploads"), { recursive: true }),
    mkdir(path.join(tempRoot, "rendered"), { recursive: true }),
    mkdir(path.join(tempRoot, "runtime"), { recursive: true })
  ]);
  setTestEnvironment(tempRoot);
});

after(async () => {
  if (tempRoot) {
    await rm(tempRoot, { force: true, recursive: true });
  }
});

describe("security tests", () => {
  it("sanitizes script elements", () => {
    const html = sanitizeHtml("<main><script>alert(1)</script><p>safe</p></main>");

    assert.equal(html, "<main><p>safe</p></main>");
  });

  it("sanitizes onerror attributes", () => {
    const html = sanitizeHtml('<img src="/image.png" onerror="alert(1)">');

    assert.equal(html, '<img src="/image.png">');
  });

  it("sanitizes javascript links", () => {
    const html = sanitizeHtml('<a href="javascript:alert(1)">bad</a>');

    assert.equal(html, "<a>bad</a>");
  });

  it("removes iframe elements by default", () => {
    const html = sanitizeHtml('<p>before</p><iframe src="https://example.test"></iframe><p>after</p>');

    assert.equal(html, "<p>before</p><p>after</p>");
  });

  it("rejects SVG uploads", async () => {
    const repository = new MemoryAttachmentRepository();
    const service = await createAttachmentService(repository);

    await assert.rejects(
      () => service.uploadAttachment(1, uploadFile({
        buffer: Buffer.from("<svg></svg>"),
        filename: "bad.svg",
        mimeType: "image/svg+xml"
      })),
      assertValidationError
    );
    assert.equal(repository.attachments.length, 0);
  });

  it("rejects exe uploads", async () => {
    const repository = new MemoryAttachmentRepository();
    const service = await createAttachmentService(repository);

    await assert.rejects(
      () => service.uploadAttachment(1, uploadFile({
        buffer: Buffer.from("MZ"),
        filename: "bad.exe",
        mimeType: "application/x-msdownload"
      })),
      assertValidationError
    );
    assert.equal(repository.attachments.length, 0);
  });

  it("does not use ../../ filenames as attachment storage paths", async () => {
    const repository = new MemoryAttachmentRepository();
    const service = await createAttachmentService(repository);
    const result = await service.uploadAttachment(1, uploadFile({
      filename: "../../evil.png"
    }));
    const attachment = repository.attachments[0];
    const { storagePaths } = await import("../config/paths.js");
    const storedRelativePath = attachment.storageKey.replace(/^uploads\//, "");
    const storedAbsolutePath = path.join(storagePaths.uploadsDir, storedRelativePath);
    const storedBytes = await readFile(storedAbsolutePath);

    assert.equal(result.markdown, `attachment://${attachment.id}`);
    assert.equal(path.isAbsolute(attachment.storageKey), false);
    assert.doesNotMatch(attachment.storageKey, /\.\./);
    assert.doesNotMatch(attachment.storageKey, /evil/i);
    assert.match(attachment.storageKey, /^uploads\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9]{64}\.png$/);
    assert.deepEqual(storedBytes, pngBytes);
  });

  it("redacts password, token, TOTP secret, Passkey fields, and API keys from logs", () => {
    const line = captureInfoLog({
      apiKey: "plain-ai-api-key",
      password: "plain-password-value",
      token: "plain-token-value",
      totpSecret: "plain-totp-secret-value",
      passkey: {
        credentialId: "plain-passkey-credential",
        publicKey: "plain-passkey-public-key"
      }
    });

    assert.doesNotMatch(line, /plain-ai-api-key/);
    assert.doesNotMatch(line, /plain-password-value/);
    assert.doesNotMatch(line, /plain-token-value/);
    assert.doesNotMatch(line, /plain-totp-secret-value/);
    assert.doesNotMatch(line, /plain-passkey-credential/);
    assert.doesNotMatch(line, /plain-passkey-public-key/);
    assert.match(line, /\[REDACTED\]/);
  });
});
