import { mkdirSync } from "node:fs";
import path from "node:path";

const testStorageRoot = path.resolve(".tmp", "server-test-storage");

mkdirSync(path.join(testStorageRoot, "uploads"), { recursive: true });
mkdirSync(path.join(testStorageRoot, "rendered"), { recursive: true });
mkdirSync(path.join(testStorageRoot, "runtime"), { recursive: true });

process.env.APP_ENV ??= "test";
process.env.APP_PORT ??= "3100";
process.env.DATABASE_HOST ??= "127.0.0.1";
process.env.DATABASE_PORT ??= "3306";
process.env.DATABASE_NAME ??= "liax_test";
process.env.DATABASE_USER ??= "liax_test";
process.env.DATABASE_PASSWORD ??= "liax_test";
process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.PASSWORD_PEPPER ??= "test-password-pepper";
process.env.STORAGE_UPLOADS_DIR ??= path.join(testStorageRoot, "uploads");
process.env.STORAGE_RENDERED_DIR ??= path.join(testStorageRoot, "rendered");
process.env.STORAGE_RUNTIME_DIR ??= path.join(testStorageRoot, "runtime");
process.env.PUBLIC_BASE_URL ??= "http://127.0.0.1:3100";
