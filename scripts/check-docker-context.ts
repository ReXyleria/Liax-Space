import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type CheckLevel = "OK" | "WARN" | "ERROR";

type CheckResult = {
  level: CheckLevel;
  message: string;
};

const projectRoot = process.cwd();

const requiredIgnoreEntries = [
  ".git",
  ".github",
  ".playwright-mcp",
  ".codex",
  ".tmp",
  "docs",
  "decisions",
  "tests",
  "scripts",
  "test-results",
  "coverage",
  "node_modules",
  "**/node_modules",
  "dist",
  "**/dist",
  "apps/server/src/test",
  "apps/server/src/**/*.test.ts",
  "apps/admin/src/test",
  "apps/admin/src/**/*.test.ts",
  ".env",
  ".env.*",
  ".env.example",
  "*.log",
  "*.out",
  "*.err",
  "liax-admin-running*.png",
  "storage/uploads/*",
  "!storage/uploads/.gitkeep",
  "storage/rendered/*",
  "!storage/rendered/.gitkeep",
  "storage/runtime/*",
  "!storage/runtime/.gitkeep",
  "storage/backups/*",
  "!storage/backups/.gitkeep"
];

const requiredFiles = [
  "Dockerfile",
  "docker-compose.yml",
  ".dockerignore",
  ".github/workflows/docker-publish.yml",
  ".github/workflows/dockerhub.yml",
  "apps/server/package-lock.json",
  "apps/admin/package-lock.json",
  "apps/server/src/database/migrate.ts",
  "apps/server/src/jobs/runBackup.ts",
  "apps/server/src/jobs/runRestore.ts",
  "apps/server/src/jobs/runRebuildHtml.ts",
  "apps/server/src/jobs/runCheckConsistency.ts",
  "apps/server/src/jobs/runCleanupRenderedHtml.ts",
  "apps/server/src/jobs/runCleanupUnusedAttachments.ts",
  "apps/server/src/setup/createSetupToken.ts",
  "scripts/run-server-dist-job.ts",
  "scripts/create-setup-token.ts",
  "scripts/rebuild-html.ts",
  "scripts/check-consistency.ts",
  "scripts/check-install-chain.ts",
  "scripts/backup.ts",
  "scripts/restore.ts",
  "scripts/cleanup-rendered-html.ts",
  "scripts/cleanup-unused-attachments.ts"
];

const requiredEnvKeys = [
  "DATABASE_USER",
  "DATABASE_PASSWORD"
];

function ok(message: string): CheckResult {
  return { level: "OK", message };
}

function warn(message: string): CheckResult {
  return { level: "WARN", message };
}

function error(message: string): CheckResult {
  return { level: "ERROR", message };
}

function readText(relativePath: string): string | undefined {
  const absolutePath = path.join(projectRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : undefined;
}

function hasLine(content: string, expectedLine: string): boolean {
  return content.split(/\r?\n/u).some((line) => line.trim() === expectedLine);
}

function checkRequiredFiles(): CheckResult[] {
  return requiredFiles.map((relativePath) => {
    const exists = existsSync(path.join(projectRoot, relativePath));
    return exists ? ok(`${relativePath} exists.`) : error(`${relativePath} is missing.`);
  });
}

function checkDockerignore(): CheckResult[] {
  const content = readText(".dockerignore");
  if (!content) {
    return [error(".dockerignore is missing.")];
  }

  return requiredIgnoreEntries.map((entry) =>
    hasLine(content, entry)
      ? ok(`.dockerignore contains ${entry}.`)
      : error(`.dockerignore must contain ${entry}.`)
  );
}

function checkDockerfile(): CheckResult[] {
  const content = readText("Dockerfile");
  if (!content) {
    return [error("Dockerfile is missing.")];
  }

  const checks: Array<[boolean, string, string]> = [
    [
      content.includes("ARG NODE_DEV_IMAGE=node:22-bookworm-slim") &&
        content.includes("ARG NODE_RUNTIME_IMAGE=node:22-bookworm-slim"),
      "Dockerfile declares default Node build and runtime images.",
      "Dockerfile must declare default NODE_DEV_IMAGE and NODE_RUNTIME_IMAGE values."
    ],
    [
      content.includes("FROM ${NODE_DEV_IMAGE}") &&
        content.includes("FROM ${NODE_RUNTIME_IMAGE} AS runner"),
      "Dockerfile uses Node build and runtime image args.",
      "Dockerfile must use NODE_DEV_IMAGE and NODE_RUNTIME_IMAGE in FROM lines."
    ],
    [
      !content.includes("node:latest"),
      "Dockerfile avoids latest tags.",
      "Dockerfile must not use node:latest."
    ],
    [
      content.includes("COPY --from=server-build /app/apps/server/dist ./apps/server/dist") &&
        content.includes("COPY --from=admin-build /app/apps/admin/dist ./apps/admin/dist"),
      "Dockerfile copies compiled server and admin artifacts.",
      "Dockerfile must copy compiled server dist and admin dist artifacts."
    ],
    [
      content.includes("COPY apps/server/migrations ./apps/server/migrations") &&
        content.includes("COPY apps/server/seeds ./apps/server/seeds"),
      "Dockerfile includes migration and seed files.",
      "Dockerfile must include migration and seed files for deployment operations."
    ],
    [
      content.includes('CMD ["node", "apps/server/dist/server.js"]'),
      "Dockerfile starts the compiled server entrypoint.",
      "Dockerfile must start node apps/server/dist/server.js."
    ],
    [
      !content.includes("COPY . ."),
      "Dockerfile avoids broad COPY instructions.",
      "Dockerfile must not use broad COPY . . instructions."
    ]
  ];

  const runnerStart = content.indexOf("FROM ${NODE_RUNTIME_IMAGE} AS runner");
  const runnerStage = runnerStart >= 0 ? content.slice(runnerStart) : "";
  const runnerChecks: Array<[boolean, string, string]> = [
    [
      runnerStage.includes("COPY --from=server-prod-deps /app/apps/server/node_modules ./apps/server/node_modules") &&
        runnerStage.includes("COPY --from=server-build /app/apps/server/dist ./apps/server/dist"),
      "Runtime image copies production server dependencies and compiled server dist only.",
      "Runtime image must copy production server dependencies and compiled server dist."
    ],
    [
      runnerStage.includes("COPY --from=admin-build /app/apps/admin/dist ./apps/admin/dist"),
      "Runtime image copies compiled admin dist.",
      "Runtime image must copy compiled admin dist."
    ],
    [
      !runnerStage.includes("COPY apps/server ./apps/server") &&
        !runnerStage.includes("COPY apps/admin ./apps/admin") &&
        !runnerStage.includes("COPY packages") &&
        !runnerStage.includes("COPY docs") &&
        !runnerStage.includes("COPY tests") &&
        !runnerStage.includes("COPY scripts") &&
        !runnerStage.includes("COPY .env") &&
        !runnerStage.includes("package-lock.json") &&
        !runnerStage.includes("COPY .github") &&
        !runnerStage.includes("COPY .git"),
      "Runtime image does not copy source trees, workspace packages, docs, tests, scripts, lockfiles, Git metadata, or env files.",
      "Runtime image must not copy source trees, workspace packages, docs, tests, scripts, lockfiles, Git metadata, or env files."
    ]
  ];

  return [...checks, ...runnerChecks].map(([passed, success, failure]) =>
    passed ? ok(success) : error(failure)
  );
}

function checkCompose(): CheckResult[] {
  const content = readText("docker-compose.yml");
  if (!content) {
    return [error("docker-compose.yml is missing.")];
  }

  const disallowedMounts = [
    ".:/app",
    "./:/app",
    "${PWD}",
    "$PWD",
    "apps/server",
    "apps/admin",
    "packages:",
    "docs:",
    "tests:",
    "scripts:",
    "/var/run/docker.sock"
  ];
  const foundDisallowedMounts = disallowedMounts.filter((term) => content.includes(term));

  const checks: Array<[boolean, string, string]> = [
    [
      content.includes("services:") && content.includes("mysql:") && content.includes("app:"),
      "Compose defines mysql and app services.",
      "Compose must define mysql and app services."
    ],
    [
      !content.includes("NODE_DEV_IMAGE") &&
        !content.includes("NODE_RUNTIME_IMAGE"),
      "Compose does not require external Node image build args.",
      "Compose must not require external Node image variables for the user-specified workflow."
    ],
    [
      content.includes("APP_ENV: production") &&
        content.includes("APP_HOST: 0.0.0.0") &&
        content.includes("DATABASE_HOST: mysql") &&
        content.includes("DATABASE_USER: ${DATABASE_USER:-root}") &&
        content.includes("DATABASE_PASSWORD: ${DATABASE_PASSWORD:-root}"),
      "Compose sets production app environment and database credentials.",
      "Compose must set production environment and database credentials."
    ],
    [
      content.includes("STORAGE_UPLOADS_DIR: /app/storage/uploads") &&
        content.includes("STORAGE_RENDERED_DIR: /app/storage/rendered") &&
        content.includes("STORAGE_RUNTIME_DIR: /app/storage/runtime"),
      "Compose points storage directories at mounted runtime paths.",
      "Compose must point storage directories at mounted runtime paths."
    ],
    [
      content.includes("mysql-data:") &&
        content.includes("uploads:") &&
        content.includes("rendered:") &&
        content.includes("runtime:") &&
        content.includes("backups:"),
      "Compose defines data volumes for MySQL, uploads, rendered, runtime, and backups.",
      "Compose must define MySQL, uploads, rendered, runtime, and backups volumes."
    ],
    [
      content.includes("condition: service_healthy"),
      "Compose waits for MySQL health before starting the app.",
      "Compose app service must wait for MySQL health."
    ],
    [
      foundDisallowedMounts.length === 0,
      "Compose app service does not mount source trees, scripts, tests, docs, workspace packages, or Docker socket.",
      `Compose must not mount development-only paths or Docker socket: ${foundDisallowedMounts.join(", ")}.`
    ]
  ];

  return checks.map(([passed, success, failure]) => (passed ? ok(success) : error(failure)));
}

function checkWorkflow(relativePath: string, requiredTerms: string[]): CheckResult[] {
  const content = readText(relativePath);
  if (!content) {
    return [error(`${relativePath} is missing.`)];
  }

  return requiredTerms.map((term) =>
    content.includes(term)
      ? ok(`${relativePath} contains ${term}.`)
      : error(`${relativePath} must contain ${term}.`)
  );
}

function checkWorkflowParity(): CheckResult[] {
  return [
    ...checkWorkflow(".github/workflows/docker-publish.yml", [
      "name: Publish Docker image",
      "IMAGE_NAME: ghcr.io/rexyleria/liax-space",
      "branches:",
      "- main",
      "- \"v*\"",
      "permissions:",
      "packages: write",
      "docker/setup-buildx-action@v3",
      "docker/login-action@v3",
      "registry: ghcr.io",
      "docker/build-push-action@v6",
      "file: ./Dockerfile",
      "${{ env.IMAGE_NAME }}:latest",
      "${{ env.IMAGE_NAME }}:${{ github.sha }}",
      "cache-from: type=gha",
      "cache-to: type=gha,mode=max"
    ]),
    ...checkWorkflow(".github/workflows/dockerhub.yml", [
      "name: Publish Docker Hub image",
      "IMAGE_NAME: rexyleria/liax-space",
      "- main",
      "- test",
      "docker/login-action@v3",
      "DOCKERHUB_USERNAME",
      "DOCKERHUB_TOKEN",
      "docker/setup-buildx-action@v3",
      "docker/build-push-action@v6",
      "platforms: linux/amd64",
      "${IMAGE_NAME}:latest,${IMAGE_NAME}:${GITHUB_SHA::7}",
      "${IMAGE_NAME}:test,${IMAGE_NAME}:test-${GITHUB_SHA::7}"
    ]),
    ...(readText(".github/workflows/dockerhub.yml")?.includes("DOCKERHUB_USERNAME") &&
    readText(".github/workflows/dockerhub.yml")?.includes("DOCKERHUB_TOKEN")
      ? [ok("Docker Hub workflow requires Docker Hub username and token.")]
      : [error("Docker Hub workflow must require DOCKERHUB_USERNAME and DOCKERHUB_TOKEN.")])
  ];
}

function checkEnvExample(): CheckResult[] {
  const content = readText(".env.example");
  if (!content) {
    return [warn(".env.example is ignored and optional for Docker context checks.")];
  }

  const keyCounts = new Map<string, number>();
  for (const line of content.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const [key] = trimmedLine.split("=", 1);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  const duplicateResults = [...keyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => error(`.env.example defines ${key} ${count} times.`));
  const unexpectedKeys = [...keyCounts.keys()].filter((key) => !requiredEnvKeys.includes(key));

  return [
    ...requiredEnvKeys.map((key) => {
      const count = keyCounts.get(key) ?? 0;
      if (count === 0) {
        return error(`.env.example must include ${key}.`);
      }

      return count === 1
        ? ok(`.env.example includes ${key}.`)
        : error(`.env.example must include ${key} only once.`);
    }),
    unexpectedKeys.length === 0
      ? ok(".env.example contains only database account placeholders.")
      : error(`.env.example must not contain non-database keys: ${unexpectedKeys.join(", ")}.`),
    ...duplicateResults
  ];
}

function checkDeploymentGuide(): CheckResult[] {
  const content = readText("docs/docker-compose-deployment-guide.md");
  if (!content) {
    return [warn("docs/docker-compose-deployment-guide.md is ignored and optional for Docker context checks.")];
  }

  const requiredTerms = [
    "docker compose version",
    "docker compose config",
    "docker compose up --build -d",
    "npm run check:docker-context",
    "npm run check:acceptance",
    "npm run check:install",
    "npm run check:install -- --probe-docker",
    "npm run check:install -- --strict-docker",
    "createSetupToken.js",
    "runBackup.js",
    "runRebuildHtml.js",
    "runCheckConsistency.js",
    "storage/uploads",
    "源数据",
    "可重建产物",
    "/console",
    "/zh",
    "/en"
  ];

  return requiredTerms.map((term) =>
    content.includes(term)
      ? ok(`Deployment guide explains ${term}.`)
      : error(`Deployment guide must explain ${term}.`)
  );
}

function checkServerBuildBoundary(): CheckResult[] {
  const tsconfig = readText("apps/server/tsconfig.json");
  const packageJson = readText("apps/server/package.json");

  return [
    tsconfig?.includes('"exclude"') &&
      tsconfig.includes('"src/**/*.test.ts"') &&
      tsconfig.includes('"src/test/**/*.ts"')
      ? ok("Server tsconfig excludes test files from production dist.")
      : error("Server tsconfig must exclude test files from production dist."),
    packageJson?.includes("rmSync('dist',{recursive:true,force:true})") &&
      packageJson.includes("tsc -p tsconfig.json")
      ? ok("Server build cleans dist before compiling.")
      : error("Server build must clean dist before compiling to avoid stale files.")
  ];
}

function checkRootScriptEntrypoints(): CheckResult[] {
  const packageJson = readText("package.json");
  const wrapper = readText("scripts/run-server-dist-job.ts");

  const expectedRootScripts = [
    '"check:consistency": "node scripts/check-consistency.ts"',
    '"check:install": "node scripts/check-install-chain.ts"',
    '"create-setup-token": "node scripts/create-setup-token.ts"',
    '"rebuild-html": "node scripts/rebuild-html.ts"',
    '"backup": "node scripts/backup.ts"',
    '"restore": "node scripts/restore.ts"',
    '"cleanup:rendered": "node scripts/cleanup-rendered-html.ts"',
    '"cleanup:attachments": "node scripts/cleanup-unused-attachments.ts"'
  ];

  return [
    ...expectedRootScripts.map((script) =>
      packageJson?.includes(script)
        ? ok(`Root package exposes ${script}.`)
        : error(`Root package must expose ${script}.`)
    ),
    wrapper?.includes("Run npm run build first.")
      ? ok("Root job wrapper reports a clear build-first error when dist is missing.")
      : error("Root job wrapper must report a clear build-first error when dist is missing."),
    wrapper?.includes("spawn(process.execPath") && wrapper.includes("shell: false")
      ? ok("Root job wrapper runs compiled server jobs without shell interpolation.")
      : error("Root job wrapper must run compiled server jobs without shell interpolation.")
  ];
}

function checkServerProdEntrypoints(): CheckResult[] {
  const packageJson = readText("apps/server/package.json");

  const expectedServerScripts = [
    '"migrate:latest:prod": "node dist/database/migrate.js latest"',
    '"migrate:rollback:prod": "node dist/database/migrate.js rollback"',
    '"create-setup-token:prod": "node dist/setup/createSetupToken.js"',
    '"backup:prod": "node dist/jobs/runBackup.js"',
    '"restore:prod": "node dist/jobs/runRestore.js"',
    '"rebuild-html:prod": "node dist/jobs/runRebuildHtml.js"',
    '"check-consistency:prod": "node dist/jobs/runCheckConsistency.js"',
    '"cleanup-rendered-html:prod": "node dist/jobs/runCleanupRenderedHtml.js"',
    '"cleanup-unused-attachments:prod": "node dist/jobs/runCleanupUnusedAttachments.js"'
  ];

  return expectedServerScripts.map((script) =>
    packageJson?.includes(script)
      ? ok(`Server package exposes ${script}.`)
      : error(`Server package must expose ${script}.`)
  );
}

function checkLocalOnlyFiles(): CheckResult[] {
  const localOnlyFiles = [
    ".env",
    "admin-dev.out",
    "admin-dev.err",
    "server-current.out",
    "server-current.err",
    "server-dev.out",
    "server-dev.err",
    "liax-admin-running.png",
    "liax-admin-running-en.png"
  ];

  return localOnlyFiles
    .filter((relativePath) => existsSync(path.join(projectRoot, relativePath)))
    .map((relativePath) =>
      warn(`${relativePath} exists locally and must stay excluded from Docker context and Git.`)
    );
}

const results = [
  ...checkRequiredFiles(),
  ...checkDockerignore(),
  ...checkDockerfile(),
  ...checkCompose(),
  ...checkWorkflowParity(),
  ...checkEnvExample(),
  ...checkDeploymentGuide(),
  ...checkServerBuildBoundary(),
  ...checkRootScriptEntrypoints(),
  ...checkServerProdEntrypoints(),
  ...checkLocalOnlyFiles()
];

for (const result of results) {
  console.log(`${result.level} ${result.message}`);
}

if (results.some((result) => result.level === "ERROR")) {
  process.exitCode = 1;
}
