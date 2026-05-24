/* eslint-disable @typescript-eslint/no-require-imports */
const { build } = require("esbuild");
const { existsSync } = require("node:fs");
const { mkdir, readFile, rm } = require("node:fs/promises");
const { builtinModules, createRequire } = require("node:module");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const outdir = resolve(root, ".next/worker");
const outfile = resolve(root, outdir, "worker.cjs");
const requireFromRoot = createRequire(resolve(root, "package.json"));
const builtinModuleNames = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`)
]);
const prismaExternals = new Set([
  "@prisma/client",
  ".prisma/client"
]);

function isBareModulePath(path) {
  return (
    !path.startsWith("node:") &&
    !path.startsWith("./") &&
    !path.startsWith("../") &&
    !path.startsWith("/") &&
    !/^[A-Za-z]:[\\/]/.test(path)
  );
}

function resolveSourcePath(path) {
  for (const candidate of [
    path,
    `${path}.ts`,
    `${path}.tsx`,
    `${path}.js`,
    `${path}.jsx`,
    `${path}.mjs`,
    `${path}.cjs`,
    `${path}.json`,
    resolve(path, "index.ts"),
    resolve(path, "index.tsx"),
    resolve(path, "index.js"),
    resolve(path, "index.mjs"),
    resolve(path, "index.cjs"),
    resolve(path, "index.json")
  ]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return path;
}

const workspacePathPlugin = {
  name: "workspace-paths",
  setup(build) {
    build.onResolve({ filter: /^\.\/src\// }, (args) => ({
      path: resolveSourcePath(resolve(root, args.path.slice("./".length)))
    }));
    build.onResolve({ filter: /^@\// }, (args) => ({
      path: resolveSourcePath(resolve(root, "src", args.path.slice("@/".length)))
    }));
    build.onResolve({ filter: /^\.\.?\// }, (args) => ({
      path: resolveSourcePath(resolve(args.resolveDir || root, args.path))
    }));
    build.onResolve({ filter: /.*/ }, (args) => {
      if (builtinModuleNames.has(args.path)) {
        return { path: args.path, external: true };
      }

      if (
        prismaExternals.has(args.path) ||
        args.path.startsWith("@prisma/client/") ||
        args.path.startsWith(".prisma/client/")
      ) {
        return { path: args.path, external: true };
      }

      if (!isBareModulePath(args.path)) {
        return undefined;
      }

      return { path: requireFromRoot.resolve(args.path) };
    });
  }
};

async function main() {
  const workerSource = (await readFile(resolve(root, "scripts/worker.ts"), "utf8")).replaceAll("../src/", "./src/");

  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  await build({
    absWorkingDir: root,
    stdin: {
      contents: workerSource,
      loader: "ts",
      resolveDir: root,
      sourcefile: "scripts/worker.ts"
    },
    outfile,
    bundle: true,
    plugins: [workspacePathPlugin],
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
