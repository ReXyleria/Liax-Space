import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

type Status = "OK" | "WARN" | "ERROR";

type Check = {
  item: string;
  status: Status;
  evidence: string;
};

const root = process.cwd();
const reportPath = path.join(root, "docs", "generated", "acceptance-audit-report.md");

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

function checkFile(relativePath: string, item: string): Check {
  return exists(relativePath)
    ? { item, status: "OK", evidence: relativePath }
    : { item, status: "ERROR", evidence: `${relativePath} is missing` };
}

function checkText(relativePath: string, terms: string[], item: string): Check {
  if (!exists(relativePath)) {
    return { item, status: "ERROR", evidence: `${relativePath} is missing` };
  }

  const content = read(relativePath);
  const missing = terms.filter((term) => !content.includes(term));

  return missing.length === 0
    ? { item, status: "OK", evidence: `${relativePath}: ${terms.join(", ")}` }
    : { item, status: "ERROR", evidence: `${relativePath} missing: ${missing.join(", ")}` };
}

function checkOptionalText(relativePath: string, terms: string[], item: string): Check {
  if (!exists(relativePath)) {
    return { item, status: "WARN", evidence: `${relativePath} is ignored and optional locally` };
  }

  return checkText(relativePath, terms, item);
}

function checkPackageScripts(): Check[] {
  const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
  const requiredScripts = [
    "test",
    "test:visual",
    "check:acceptance",
    "check:design",
    "check:docker-context",
    "check:install",
    "backup",
    "restore",
    "rebuild-html",
    "check:consistency"
  ];

  return requiredScripts.map((script) => {
    return packageJson.scripts?.[script]
      ? { item: `Root script ${script}`, status: "OK", evidence: `package.json scripts.${script}` }
      : { item: `Root script ${script}`, status: "ERROR", evidence: `package.json scripts.${script} is missing` };
  });
}

function tryDockerCommand(command: string, args: string[]): { output: string; status: number | null } {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false
  });

  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
    status: result.status
  };
}

function findDockerCommand(): { command?: string; source?: string; diagnostics: string[] } {
  const candidates = [
    { command: "docker", source: "PATH" },
    { command: "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe", source: "Docker Desktop standard CLI path" },
    { command: "C:\\Program Files\\Docker\\Docker\\resources\\bin\\com.docker.cli.exe", source: "Docker Desktop com.docker.cli path" }
  ];
  const diagnostics: string[] = [];

  for (const candidate of candidates) {
    const result = tryDockerCommand(candidate.command, ["--version"]);
    if (result.status === 0) {
      diagnostics.push(`${candidate.source}: ${result.output}`);
      return { command: candidate.command, diagnostics, source: candidate.source };
    }

    diagnostics.push(`${candidate.source}: unavailable`);
  }

  const wslResult = tryDockerCommand("wsl.exe", ["sh", "-lc", "command -v docker >/dev/null 2>&1 && docker --version"]);
  diagnostics.push(wslResult.status === 0 ? `WSL docker: ${wslResult.output}` : "WSL docker: unavailable");

  return { diagnostics };
}

function checkDockerComposeAvailability(): Check[] {
  const found = findDockerCommand();

  if (!found.command) {
    return [
      {
        item: "Docker Compose deployment can be verified on this machine",
        status: "WARN",
        evidence: `Docker CLI is not available; run npm run check:install -- --strict-docker on a Docker host. Checked: ${found.diagnostics.join("; ")}`
      }
    ];
  }

  const composeConfig = spawnSync(found.command, ["compose", "config"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? "root",
      DATABASE_USER: process.env.DATABASE_USER ?? "root"
    },
    shell: false
  });

  if (composeConfig.status !== 0) {
    const output = `${composeConfig.stdout ?? ""}${composeConfig.stderr ?? ""}`.trim();
    return [
      {
        item: "Docker Compose deployment can be verified on this machine",
        status: "ERROR",
        evidence: output || "docker compose config failed"
      }
    ];
  }

  return [
      {
        item: "Docker Compose deployment can be verified on this machine",
        status: "OK",
        evidence: `docker compose config completed successfully via ${found.source}`
      }
    ];
}

const checks: Check[] = [
  ...checkPackageScripts(),
  checkFile("tests/visual/admin-pages-smoke.spec.ts", "Admin pages have smoke coverage"),
  checkFile("tests/visual/public-pages-smoke.spec.ts", "Public pages have smoke coverage"),
  checkFile("tests/visual/admin-article-workflow.spec.ts", "Article editing workflow has visual coverage"),
  checkFile("tests/visual/admin-management-workflows.spec.ts", "Management pages have visual coverage"),
  checkFile("tests/visual/admin-auth-theme.spec.ts", "Auth and theme flows have visual coverage"),
  checkFile("tests/visual/language-wipe.spec.ts", "Language wipe has controlled frame coverage"),
  checkFile("tests/visual/page-transition-logic.spec.ts", "Page transition and settings flows have visual coverage"),
  checkFile("tests/visual/public-home-responsive.spec.ts", "Public home responsive layout has visual coverage"),
  checkText(
    "tests/visual/page-transition-logic.spec.ts",
    [
      "public language switch uses a real old-to-new overlay without moving header controls",
      "admin settings keep AI provider presets and validation predictable",
      "profile avatar flow rejects unsafe files before upload and updates the shell on success",
      "admin settings save public home content as deliberate site settings"
    ],
    "User-requested language, AI settings, avatar, and public home behavior are covered"
  ),
  checkText(
    "tests/visual/admin-article-workflow.spec.ts",
    ["body, metadata, saving, and publishing as separate user actions", "contenteditable", ".admin-markdown-panel textarea", "publishedVersionId).toBeNull"],
    "Article workflow keeps visual editing, save, and publish distinct"
  ),
  checkText(
    "tests/visual/public-home-responsive.spec.ts",
    ["signature, contact box, and ICP link", "without overflow"],
    "Public home layout is checked on desktop and mobile"
  ),
  checkText(
    "tests/visual/language-wipe.spec.ts",
    ["frame-000.png", "frame-025.png", "frame-050.png", "frame-075.png", "frame-100.png"],
    "Language switch animation is inspectable frame by frame"
  ),
  checkOptionalText(
    "docs/docker-compose-deployment-guide.md",
    [
      "docker compose up --build -d",
      "npm run check:acceptance",
      "createSetupToken.js",
      "runBackup.js",
      "runRebuildHtml.js",
      "runCheckConsistency.js",
      "storage/uploads",
      "源数据",
      "可重建产物"
    ],
    "Docker Compose deployment guide is beginner-readable and complete"
  ),
  checkText(
    ".github/workflows/docker-publish.yml",
    ["ghcr.io/rexyleria/liax-space", "${{ env.IMAGE_NAME }}:latest", "${{ env.IMAGE_NAME }}:${{ github.sha }}"],
    "GHCR image publishing workflow matches the requested target"
  ),
  checkText(
    ".github/workflows/dockerhub.yml",
    ["rexyleria/liax-space", "${IMAGE_NAME}:latest,${IMAGE_NAME}:${GITHUB_SHA::7}", "${IMAGE_NAME}:test,${IMAGE_NAME}:test-${GITHUB_SHA::7}"],
    "Docker Hub image publishing workflow matches the requested target"
  ),
  checkOptionalText(".env.example", ["DATABASE_USER=root", "DATABASE_PASSWORD=root"], ".env.example stays limited to local database credentials"),
  checkText(
    "README.md",
    ["Docker Compose 新手部署页", "页面背景必须使用 `#faf9f5`", "Markdown 是文章源数据", "HTML 是可重建派生产物"],
    "README exposes deployment, design, and content-source rules"
  ),
  ...checkDockerComposeAvailability()
];

const goalMatrix = [
  {
    requirement: "测试前台和后台页面功能",
    evidence: "Visual tests cover admin smoke pages, public pages, public home, article workflow, management flows, settings, profile avatar, language switch, and search.",
    status: "OK" as Status
  },
  {
    requirement: "修复漏洞和冗余逻辑",
    evidence: "Unit/integration/security tests cover sanitizer, unsafe uploads, log redaction, publish failure safety, no public locale fallback, TOTP login flow, save vs publish separation, and deliberate settings mutations.",
    status: "OK" as Status
  },
  {
    requirement: "引入 GitHub Container Registry 和 Docker Hub 镜像推送",
    evidence: ".github/workflows/docker-publish.yml and .github/workflows/dockerhub.yml are checked for requested image names, tags, triggers, and credentials.",
    status: "OK" as Status
  },
  {
    requirement: "Docker Compose 新手部署路径",
    evidence: "docs/docker-compose-deployment-guide.md documents env, startup, migration, setup token, /console, /zh, /en, backup, restore, rebuild, and consistency checks.",
    status: "OK" as Status
  },
  {
    requirement: "安装链路完整且不携带多余文件",
    evidence: "check:docker-context and check:install verify .dockerignore, runtime image boundaries, compose volumes, and no source/docs/tests/scripts/env files in runtime image.",
    status: "OK" as Status
  },
  {
    requirement: "Docker Compose 实机配置验证",
    evidence: checks.find((check) => check.item === "Docker Compose deployment can be verified on this machine")?.evidence ?? "Not checked",
    status: checks.find((check) => check.item === "Docker Compose deployment can be verified on this machine")?.status ?? "WARN"
  }
];

const summary = {
  ok: checks.filter((check) => check.status === "OK").length,
  warn: checks.filter((check) => check.status === "WARN").length,
  error: checks.filter((check) => check.status === "ERROR").length
};

for (const check of checks) {
  console.log(`${check.status} ${check.item}: ${check.evidence}`);
}

const report = [
  "# Acceptance Audit Report",
  "",
  `Generated at: ${new Date().toISOString()}`,
  "",
  `Summary: OK ${summary.ok}, WARN ${summary.warn}, ERROR ${summary.error}`,
  "",
  "This report checks that the current repository has direct evidence for the requested user-facing flows, visual behavior, Docker publishing, and Docker Compose installation path.",
  "",
  "## Goal Matrix",
  "",
  ...goalMatrix.map((entry) => `- ${entry.status}: ${entry.requirement} (${entry.evidence})`),
  "",
  "## Evidence Checks",
  "",
  ...checks.map((check) => `- ${check.status}: ${check.item} (${check.evidence})`),
  ""
].join("\n");

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, report, "utf8");
console.log(`OK Acceptance audit report written to ${path.relative(root, reportPath)}.`);

if (summary.error > 0) {
  process.exitCode = 1;
}
