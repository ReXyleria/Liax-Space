const { build } = require("esbuild");
const { mkdir, readFile, rm } = require("node:fs/promises");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const outdir = ".next/worker";
const outfile = resolve(root, outdir, "worker.cjs");

function slash(value) {
  return value.replaceAll("\\", "/");
}

async function main() {
  const workerSource = await readFile(resolve(root, "scripts/worker.ts"), "utf8");

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
    format: "cjs",
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
