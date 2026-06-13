import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type CheckStatus = "OK" | "WARN" | "ERROR";

type CheckResult = {
  message: string;
  status: CheckStatus;
};

type CommandResult = {
  output: string;
  status: number | null;
};

type DockerCommand = {
  command: string;
  source: string;
};

const projectRoot = process.cwd();
const strictDocker = process.argv.includes("--strict-docker");
const probeDocker = strictDocker || process.argv.includes("--probe-docker");
const reportPath = path.join(projectRoot, "docs", "generated", "install-check-report.md");

const requiredFiles = [
  "Dockerfile",
  "docker-compose.yml",
  ".dockerignore",
  ".github/workflows/docker-publish.yml",
  ".github/workflows/dockerhub.yml",
  "apps/server/package-lock.json",
  "apps/admin/package-lock.json"
];

const dockerignoreEntries = [
  ".env",
  ".env.*",
  ".env.example",
  ".codex",
  "node_modules",
  "**/node_modules",
  "dist",
  "**/dist",
  "docs",
  "tests",
  "scripts",
  "coverage",
  "test-results",
  "storage/uploads/*",
  "!storage/uploads/.gitkeep",
  "storage/rendered/*",
  "!storage/rendered/.gitkeep",
  "storage/runtime/*",
  "!storage/runtime/.gitkeep",
  "storage/backups/*",
  "!storage/backups/.gitkeep"
];

function ok(message: string): CheckResult {
  return { message, status: "OK" };
}

function warn(message: string): CheckResult {
  return { message, status: "WARN" };
}

function error(message: string): CheckResult {
  return { message, status: "ERROR" };
}

function readText(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function tryReadText(relativePath: string): string | null {
  const absolutePath = path.join(projectRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null;
}

function hasTrimmedLine(content: string, value: string): boolean {
  return content.split(/\r?\n/u).some((line) => line.trim() === value);
}

async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? "root",
      DATABASE_USER: process.env.DATABASE_USER ?? "root"
    },
    shell: false
  });

  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
    status: result.status
  };
}

async function findDockerCommand(): Promise<{ command?: DockerCommand; diagnostics: string[] }> {
  const candidates = [
    { command: "docker", source: "PATH" },
    { command: "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe", source: "Docker Desktop standard CLI path" },
    { command: "C:\\Program Files\\Docker\\Docker\\resources\\bin\\com.docker.cli.exe", source: "Docker Desktop com.docker.cli path" }
  ];
  const diagnostics: string[] = [];

  for (const candidate of candidates) {
    const result = await runCommand(candidate.command, ["--version"]);
    if (result.status === 0) {
      diagnostics.push(`${candidate.source}: ${result.output}`);
      return { command: candidate, diagnostics };
    }

    diagnostics.push(`${candidate.source}: unavailable`);
  }

  const wslResult = await runCommand("wsl.exe", ["sh", "-lc", "command -v docker >/dev/null 2>&1 && docker --version"]);
  diagnostics.push(wslResult.status === 0 ? `WSL docker: ${wslResult.output}` : "WSL docker: unavailable");

  return { diagnostics };
}

function checkRequiredFiles(): CheckResult[] {
  return requiredFiles.map((relativePath) => {
    return existsSync(path.join(projectRoot, relativePath))
      ? ok(`${relativePath} exists.`)
      : error(`${relativePath} is missing.`);
  });
}

function checkEnvExample(): CheckResult[] {
  const content = tryReadText(".env.example");
  if (content === null) {
    return [warn(".env.example is ignored and optional for install checks.")];
  }

  const keys = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.slice(0, line.indexOf("=")))
    .filter(Boolean);

  const allowedKeys = new Set(["DATABASE_PASSWORD", "DATABASE_USER"]);
  const unexpectedKeys = keys.filter((key) => !allowedKeys.has(key));

  return [
    keys.includes("DATABASE_USER")
      ? ok(".env.example includes DATABASE_USER.")
      : error(".env.example must include DATABASE_USER."),
    keys.includes("DATABASE_PASSWORD")
      ? ok(".env.example includes DATABASE_PASSWORD.")
      : error(".env.example must include DATABASE_PASSWORD."),
    unexpectedKeys.length === 0
      ? ok(".env.example only contains database account placeholders.")
      : error(`.env.example must not contain non-database keys: ${unexpectedKeys.join(", ")}.`)
  ];
}

function checkDockerignore(): CheckResult[] {
  const content = tryReadText(".dockerignore");
  if (content === null) {
    return [error(".dockerignore is missing.")];
  }

  return dockerignoreEntries.map((entry) => {
    return hasTrimmedLine(content, entry)
      ? ok(`.dockerignore contains ${entry}.`)
      : error(`.dockerignore must contain ${entry}.`);
  });
}

function checkComposeText(): CheckResult[] {
  const content = tryReadText("docker-compose.yml");
  if (content === null) {
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
      content.includes("mysql:") && content.includes("app:"),
      "Compose defines mysql and app services.",
      "Compose must define mysql and app services."
    ],
    [
      content.includes("image: rexyleria/liax-space:test"),
      "Compose app service uses the Docker Hub test image tag.",
      "Compose app service must use image: rexyleria/liax-space:test for Tencent testing."
    ],
    [
      content.includes("pull_policy: always"),
      "Compose always pulls the current test image before starting.",
      "Compose app service should use pull_policy: always for Tencent test deployment."
    ],
    [
      !content.includes("build:") && !content.includes(":main"),
      "Compose does not build locally and does not reference a main tag.",
      "Compose must not build locally or reference a :main tag for Tencent testing."
    ],
    [
      content.includes("condition: service_healthy"),
      "Compose waits for MySQL health before starting the app.",
      "Compose app service must wait for MySQL health."
    ],
    [
      content.includes("DATABASE_USER: ${DATABASE_USER:-root}") &&
        content.includes("DATABASE_PASSWORD: ${DATABASE_PASSWORD:-root}"),
      "Compose reads database account from .env with local defaults.",
      "Compose must read database account from .env with local defaults."
    ],
    [
      content.includes("uploads:/app/storage/uploads") &&
        content.includes("rendered:/app/storage/rendered") &&
        content.includes("runtime:/app/storage/runtime") &&
        content.includes("backups:/app/storage/backups"),
      "Compose mounts uploads, rendered, runtime, and backups volumes.",
      "Compose must mount uploads, rendered, runtime, and backups volumes."
    ],
    [
      foundDisallowedMounts.length === 0,
      "Compose does not mount source trees, scripts, tests, docs, workspace packages, or Docker socket.",
      `Compose must not mount development-only paths or Docker socket: ${foundDisallowedMounts.join(", ")}.`
    ]
  ];

  return checks.map(([passed, success, failure]) => (passed ? ok(success) : error(failure)));
}

function checkDockerfileText(): CheckResult[] {
  const content = tryReadText("Dockerfile");
  if (content === null) {
    return [error("Dockerfile is missing.")];
  }

  const runnerStart = content.indexOf("FROM ${NODE_RUNTIME_IMAGE} AS runner");
  const runnerStage = runnerStart >= 0 ? content.slice(runnerStart) : "";

  const checks: Array<[boolean, string, string]> = [
    [
      content.includes("node:22-bookworm-slim") && !content.includes("node:latest"),
      "Dockerfile uses pinned Node slim defaults and avoids latest.",
      "Dockerfile must use pinned Node slim defaults and avoid latest."
    ],
    [
      !content.includes("COPY . ."),
      "Dockerfile avoids broad COPY . . instructions.",
      "Dockerfile must not use broad COPY . . instructions."
    ],
    [
      !runnerStage.includes("COPY docs") &&
        !runnerStage.includes("COPY tests") &&
        !runnerStage.includes("COPY scripts") &&
        !runnerStage.includes("COPY .env") &&
        !runnerStage.includes("COPY packages") &&
        !runnerStage.includes("COPY apps/server ./apps/server") &&
        !runnerStage.includes("COPY apps/admin ./apps/admin") &&
        !runnerStage.includes("package-lock.json") &&
        !runnerStage.includes("COPY .github") &&
        !runnerStage.includes("COPY .git"),
      "Runtime image excludes source trees, workspace packages, docs, tests, scripts, lockfiles, Git metadata, and env files.",
      "Runtime image must exclude source trees, workspace packages, docs, tests, scripts, lockfiles, Git metadata, and env files."
    ],
    [
      runnerStage.includes("apps/server/dist") && runnerStage.includes("apps/admin/dist"),
      "Runtime image includes compiled server and admin artifacts.",
      "Runtime image must include compiled server and admin artifacts."
    ]
  ];

  return checks.map(([passed, success, failure]) => (passed ? ok(success) : error(failure)));
}

function checkWorkflowText(): CheckResult[] {
  const ghcr = tryReadText(".github/workflows/docker-publish.yml");
  const dockerHub = tryReadText(".github/workflows/dockerhub.yml");
  const results: CheckResult[] = [];

  if (ghcr === null) {
    results.push(error("GHCR workflow is missing."));
  } else {
    results.push(
      ghcr.includes("ghcr.io/rexyleria/liax-space") ? ok("GHCR workflow publishes the requested image name.") : error("GHCR workflow image name is wrong."),
      ghcr.includes("${{ env.IMAGE_NAME }}:latest") && ghcr.includes("${{ env.IMAGE_NAME }}:${{ github.sha }}")
        ? ok("GHCR workflow publishes latest and full SHA tags.")
        : error("GHCR workflow must publish latest and full SHA tags.")
    );
  }

  if (dockerHub === null) {
    results.push(error("Docker Hub workflow is missing."));
  } else {
    results.push(
      dockerHub.includes("rexyleria/liax-space") ? ok("Docker Hub workflow publishes the requested image name.") : error("Docker Hub workflow image name is wrong."),
      dockerHub.includes("DOCKERHUB_USERNAME") && dockerHub.includes("DOCKERHUB_TOKEN")
        ? ok("Docker Hub workflow uses Docker Hub secrets.")
        : error("Docker Hub workflow must use Docker Hub username and token secrets."),
      dockerHub.includes("${IMAGE_NAME}:test,${IMAGE_NAME}:test-${GITHUB_SHA::7}")
        ? ok("Docker Hub workflow publishes test tags for the test branch.")
        : error("Docker Hub workflow must publish test tags for the test branch.")
    );
  }

  return results;
}

function checkDeploymentGuide(): CheckResult[] {
  const content = tryReadText("docs/docker-compose-deployment-guide.md");
  if (content === null) {
    return [warn("docs/docker-compose-deployment-guide.md is ignored and optional for install checks.")];
  }

  const requiredTerms = [
    "docker compose version",
    "docker compose config",
    "docker compose pull",
    "docker compose up -d",
    "rexyleria/liax-space:test",
    "npm run check:acceptance",
    "runCheckConsistency.js",
    "runRebuildHtml.js",
    "createSetupToken.js",
    "storage/uploads",
    "源数据",
    "可重建产物",
    "/console",
    "/zh",
    "/en"
  ];

  return requiredTerms.map((term) => {
    return content.includes(term)
      ? ok(`Deployment guide explains ${term}.`)
      : error(`Deployment guide must explain ${term}.`);
  });
}

async function checkDockerCli(): Promise<CheckResult[]> {
  if (!probeDocker) {
    return [
      warn("Docker CLI probing was skipped. Run npm run check:install -- --probe-docker on a deployment machine, or use --strict-docker to require docker compose config.")
    ];
  }

  const found = await findDockerCommand();
  if (!found.command) {
    const message = [
      "Docker CLI is not available. Install or repair Docker Desktop, then open a new terminal before running Docker Compose deployment checks.",
      `Checked: ${found.diagnostics.join("; ")}`
    ].join(" ");
    return [strictDocker ? error(message) : warn(message)];
  }

  const version = await runCommand(found.command.command, ["--version"]);
  const composeVersion = await runCommand(found.command.command, ["compose", "version"]);
  const composeConfig = await runCommand(found.command.command, ["compose", "config"]);

  return [
    ok(`Docker CLI available from ${found.command.source}: ${version.output}`),
    composeVersion.status === 0 ? ok(`Docker Compose available: ${composeVersion.output}`) : error(`Docker Compose is not available: ${composeVersion.output}`),
    composeConfig.status === 0 ? ok("docker compose config completed successfully.") : error(`docker compose config failed: ${composeConfig.output}`)
  ];
}

function writeReport(results: CheckResult[]): void {
  const summary = {
    error: results.filter((result) => result.status === "ERROR").length,
    ok: results.filter((result) => result.status === "OK").length,
    warn: results.filter((result) => result.status === "WARN").length
  };

  const body = [
    "# Install Check Report",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    `Summary: OK ${summary.ok}, WARN ${summary.warn}, ERROR ${summary.error}`,
    "",
    ...results.map((result) => `- ${result.status}: ${result.message}`),
    ""
  ].join("\n");

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, body, "utf8");
}

async function main(): Promise<void> {
  const results = [
    ...checkRequiredFiles(),
    ...checkEnvExample(),
    ...checkDockerignore(),
    ...checkComposeText(),
    ...checkDockerfileText(),
    ...checkWorkflowText(),
    ...checkDeploymentGuide(),
    ...(await checkDockerCli())
  ];

  for (const result of results) {
    console.log(`${result.status} ${result.message}`);
  }

  writeReport(results);
  console.log(`OK Install check report written to ${path.relative(projectRoot, reportPath)}.`);

  if (results.some((result) => result.status === "ERROR")) {
    process.exitCode = 1;
  }
}

main().catch((unknownError: unknown) => {
  const message = unknownError instanceof Error ? unknownError.message : "Unknown install check failure.";
  console.error(`ERROR ${message}`);
  process.exitCode = 1;
});
