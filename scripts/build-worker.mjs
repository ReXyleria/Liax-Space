import { build } from "esbuild";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = ".next/worker";
const outfile = resolve(root, outdir, "worker.mjs");
const workerSource = await readFile(resolve(root, "scripts/worker.ts"), "utf8");

function slash(value) {
  return value.replaceAll("\\", "/");
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  absWorkingDir: slash(root),
  stdin: {
    contents: workerSource,
    loader: "ts",
    resolveDir: slash(resolve(root, "scripts")),
    sourcefile: "worker.ts"
  },
  outfile: slash(outfile),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  mainFields: ["module", "main"],
  tsconfigRaw: {
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@/*": ["./src/*"]
      }
    }
  },
  logLevel: "info",
  external: [
    "@prisma/client",
    "@prisma/client/*",
    ".prisma/client",
    ".prisma/client/*"
  ]
});
