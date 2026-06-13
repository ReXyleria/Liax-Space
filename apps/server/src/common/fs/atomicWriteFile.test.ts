import assert from "node:assert/strict";
import {
  mkdtemp,
  readdir,
  readFile,
  rename as fsRename,
  rm as fsRm,
  writeFile as fsWriteFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { atomicWriteFile, type AtomicWriteFileOperations } from "./atomicWriteFile.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "liax-atomic-write-"));
}

describe("atomicWriteFile", () => {
  it("writes to a temporary file before renaming to the target", async () => {
    const dir = await createTempDir();
    const targetPath = join(dir, "article.html");
    const calls: string[] = [];
    const operations: AtomicWriteFileOperations = {
      async writeFile(path, data) {
        calls.push(path.endsWith(".tmp") ? "write:tmp" : "write:target");
        await fsWriteFile(path, data);
      },
      async rename(oldPath, newPath) {
        calls.push(oldPath.endsWith(".tmp") && newPath === targetPath ? "rename:target" : "rename:other");
        await fsRename(oldPath, newPath);
      },
      async rm(path, options) {
        calls.push(path.endsWith(".tmp") ? "rm:tmp" : "rm:other");
        await fsRm(path, options);
      },
    };

    await atomicWriteFile(targetPath, "new html", operations);

    assert.deepEqual(calls, ["write:tmp", "rename:target"]);
    assert.equal(await readFile(targetPath, "utf8"), "new html");
  });

  it("does not leave temporary files after a successful write", async () => {
    const dir = await createTempDir();
    const targetPath = join(dir, "article.html");

    await atomicWriteFile(targetPath, "new html");

    const files = await readdir(dir);
    assert.deepEqual(files, ["article.html"]);
  });

  it("does not replace the original file when writing the temporary file fails", async () => {
    const dir = await createTempDir();
    const targetPath = join(dir, "article.html");
    const expectedError = new Error("write failed");
    const operations: AtomicWriteFileOperations = {
      async writeFile() {
        throw expectedError;
      },
      async rename() {
        assert.fail("rename should not run when temp write fails");
      },
      async rm() {},
    };

    await fsWriteFile(targetPath, "original html");

    await assert.rejects(() => atomicWriteFile(targetPath, "new html", operations), /write failed/);
    assert.equal(await readFile(targetPath, "utf8"), "original html");
  });

  it("does not replace the original file when rename fails", async () => {
    const dir = await createTempDir();
    const targetPath = join(dir, "article.html");
    const expectedError = new Error("rename failed");
    const operations: AtomicWriteFileOperations = {
      async writeFile(path, data) {
        await fsWriteFile(path, data);
      },
      async rename() {
        throw expectedError;
      },
      async rm(path, options) {
        await fsRm(path, options);
      },
    };

    await fsWriteFile(targetPath, "original html");

    await assert.rejects(() => atomicWriteFile(targetPath, "new html", operations), /rename failed/);
    assert.equal(await readFile(targetPath, "utf8"), "original html");
    assert.deepEqual(await readdir(dir), ["article.html"]);
  });
});
