import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Severity = "error" | "warning";

type SourceFile = {
  path: string;
  relativePath: string;
  content: string;
};

type Finding = {
  severity: Severity;
  check: string;
  file?: string;
  line?: number;
  message: string;
};

type CheckSummary = {
  name: string;
  status: "PASS" | "FAIL";
  reason: string;
};

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

const projectRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const reportPath = path.join(projectRoot, "docs", "generated", "design-check-report.md");
const scanDirectories = [
  path.join(projectRoot, "apps", "admin", "src"),
  path.join(projectRoot, "apps", "server", "src"),
  path.join(projectRoot, "packages", "ui", "src")
];
const sourceExtensions = new Set([".css", ".ts", ".tsx"]);
const requiredTokens = {
  "--color-page": "#faf9f5",
  "--color-surface": "#ffffff",
  "--color-surface-muted": "#f5f4ed",
  "--color-border": "#d1cfc5",
  "--color-text": "#141413",
  "--color-primary": "#141413",
  "--color-primary-text": "#faf9f5",
  "--color-brand": "#c96442",
  "--color-brand-text": "#faf9f5",
  "--color-accent": "#d97757"
} as const;
const buttonExpectations = [
  {
    check: "primary button background",
    pattern: /\.liax-button--primary\s*\{[^}]*background:\s*(?:#141413|var\(--color-primary\))/is
  },
  {
    check: "primary button text",
    pattern: /\.liax-button--primary\s*\{[^}]*color:\s*(?:#faf9f5|var\(--color-primary-text\))/is
  },
  {
    check: "brand button background",
    pattern: /\.liax-button--brand\s*\{[^}]*background:\s*(?:#c96442|var\(--color-brand\))/is
  },
  {
    check: "brand button text",
    pattern: /\.liax-button--brand\s*\{[^}]*color:\s*(?:#faf9f5|var\(--color-brand-text\))/is
  }
];
const forbiddenNearPageBackgrounds = new Set(["#fffdf7"]);

function normalizePath(filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function isTestSourceFile(filePath: string): boolean {
  return /\.test\.(?:ts|tsx)$/.test(filePath) || /\.spec\.(?:ts|tsx)$/.test(filePath);
}

async function collectSourceFiles(directory: string): Promise<SourceFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: SourceFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
      continue;
    }

    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name)) || isTestSourceFile(entry.name)) {
      continue;
    }

    files.push({
      content: await readFile(entryPath, "utf8"),
      path: entryPath,
      relativePath: normalizePath(entryPath)
    });
  }

  return files;
}

function lineForIndex(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

function findLine(content: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(content);

  return match ? lineForIndex(content, match.index) : undefined;
}

function normalizeHex(value: string): string {
  const raw = value.toLowerCase();

  if (raw.length !== 4) {
    return raw;
  }

  return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
}

function hexToRgb(value: string): RgbColor | null {
  const hex = normalizeHex(value);

  if (!/^#[a-f0-9]{6}$/.test(hex)) {
    return null;
  }

  return {
    blue: Number.parseInt(hex.slice(5, 7), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    red: Number.parseInt(hex.slice(1, 3), 16)
  };
}

function rgbToHsl(color: RgbColor): { hue: number; saturation: number; lightness: number } {
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return {
      hue: 0,
      lightness,
      saturation: 0
    };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) {
    hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  } else if (max === green) {
    hue = ((blue - red) / delta + 2) * 60;
  } else {
    hue = ((red - green) / delta + 4) * 60;
  }

  return {
    hue,
    lightness,
    saturation
  };
}

function isHighSaturationTechBlue(hex: string): boolean {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return false;
  }

  const hsl = rgbToHsl(rgb);

  return hsl.hue >= 190 && hsl.hue <= 250 && hsl.saturation >= 0.55 && hsl.lightness >= 0.2 && hsl.lightness <= 0.82;
}

function isBluePurpleHue(hex: string): boolean {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return false;
  }

  const hsl = rgbToHsl(rgb);

  return hsl.hue >= 210 && hsl.hue <= 285 && hsl.saturation >= 0.28;
}

function isOrangeBackgroundColor(value: string): boolean {
  const normalized = value.toLowerCase();

  if (/#(?:c96442|d97757|b95738|9e4b31)\b/.test(normalized)) {
    return true;
  }

  return /rgba?\(\s*(?:201\s*,\s*100\s*,\s*66|217\s*,\s*119\s*,\s*87|185\s*,\s*87\s*,\s*56)/i.test(normalized);
}

function isAllowedOrangeBackgroundSelector(selector: string): boolean {
  return selector.includes("::selection") || /\.liax-button--brand\b/.test(selector) || /brand/i.test(selector) && /button/i.test(selector);
}

function extractCssBlocks(content: string): Array<{ selector: string; body: string; index: number }> {
  const blocks: Array<{ selector: string; body: string; index: number }> = [];
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(content)) !== null) {
    blocks.push({
      body: match[2],
      index: match.index,
      selector: match[1].trim()
    });
  }

  return blocks;
}

function checkPageBackground(files: SourceFile[]): CheckSummary[] {
  const cssContent = files
    .filter((file) => file.relativePath.endsWith(".css"))
    .map((file) => file.content)
    .join("\n");
  const hasPageToken = /--color-page\s*:\s*#faf9f5\b/i.test(cssContent);
  const usesPageBackground = /(html|body|\.admin-language-wipe|#root)[^{]*\{[^}]*background:\s*(?:#faf9f5|var\(--color-page\))/is.test(cssContent);

  return [{
    name: "Page background token",
    reason: hasPageToken && usesPageBackground
      ? "CSS defines --color-page as #faf9f5 and applies it to page-level surfaces."
      : "CSS must define #faf9f5 as the page background and use it on page-level surfaces.",
    status: hasPageToken && usesPageBackground ? "PASS" : "FAIL"
  }];
}

function checkButtonTokens(files: SourceFile[], findings: Finding[]): CheckSummary {
  const buttonFile = files.find((file) => file.relativePath === "packages/ui/src/components/button.css");
  const tokenFile = files.find((file) => file.relativePath === "packages/ui/src/tokens.css");
  let passed = true;

  if (!buttonFile) {
    findings.push({
      check: "Button tokens",
      message: "packages/ui/src/components/button.css was not found.",
      severity: "error"
    });
    passed = false;
  }

  if (!tokenFile) {
    findings.push({
      check: "Button tokens",
      message: "packages/ui/src/tokens.css was not found.",
      severity: "error"
    });
    passed = false;
  }

  if (tokenFile) {
    for (const [tokenName, tokenValue] of Object.entries(requiredTokens)) {
      const pattern = new RegExp(`${tokenName}\\s*:\\s*${tokenValue.replace("#", "#")}\\b`, "i");

      if (!pattern.test(tokenFile.content)) {
        findings.push({
          check: "Button tokens",
          file: tokenFile.relativePath,
          line: findLine(tokenFile.content, new RegExp(`${tokenName}\\s*:`)),
          message: `${tokenName} must be ${tokenValue}.`,
          severity: "error"
        });
        passed = false;
      }
    }
  }

  if (buttonFile) {
    for (const expectation of buttonExpectations) {
      if (!expectation.pattern.test(buttonFile.content)) {
        findings.push({
          check: "Button tokens",
          file: buttonFile.relativePath,
          line: 1,
          message: `Missing or incorrect ${expectation.check}.`,
          severity: "error"
        });
        passed = false;
      }
    }
  }

  return {
    name: "Button token compliance",
    reason: passed
      ? "Primary and brand buttons use the approved background and text token values."
      : "One or more button or color token values do not match the design specification.",
    status: passed ? "PASS" : "FAIL"
  };
}

function scanForbiddenColors(files: SourceFile[], findings: Finding[]): CheckSummary[] {
  let techBlueCount = 0;
  let bluePurpleGradientCount = 0;
  let orangeBackgroundCount = 0;
  let pageImageBackgroundCount = 0;
  let nonTokenPageBackgroundCount = 0;

  for (const file of files) {
    const colorPattern = /#[a-f0-9]{3,6}\b/gi;
    let colorMatch: RegExpExecArray | null;

    while ((colorMatch = colorPattern.exec(file.content)) !== null) {
      const color = normalizeHex(colorMatch[0]);

      if (isHighSaturationTechBlue(color)) {
        techBlueCount += 1;
        findings.push({
          check: "Forbidden colors",
          file: file.relativePath,
          line: lineForIndex(file.content, colorMatch.index),
          message: `High-saturation tech blue is not allowed: ${color}.`,
          severity: "error"
        });
      }

      if (forbiddenNearPageBackgrounds.has(color)) {
        nonTokenPageBackgroundCount += 1;
        findings.push({
          check: "Non-token page background",
          file: file.relativePath,
          line: lineForIndex(file.content, colorMatch.index),
          message: `${color} is not allowed as a page or overlay background; use #faf9f5 or --color-page.`,
          severity: "error"
        });
      }
    }

    const gradientPattern = /(?:linear|radial|conic)-gradient\(([^)]*)\)/gi;
    let gradientMatch: RegExpExecArray | null;

    while ((gradientMatch = gradientPattern.exec(file.content)) !== null) {
      const gradientBody = gradientMatch[1];
      const gradientColors = gradientBody.match(/#[a-f0-9]{3,6}\b/gi) ?? [];
      const hasBluePurpleKeyword = /\b(?:blue|purple|violet|indigo)\b/i.test(gradientBody);
      const hasBluePurpleColor = gradientColors.some((color) => isBluePurpleHue(normalizeHex(color)));

      if (hasBluePurpleKeyword || hasBluePurpleColor) {
        bluePurpleGradientCount += 1;
        findings.push({
          check: "Forbidden colors",
          file: file.relativePath,
          line: lineForIndex(file.content, gradientMatch.index),
          message: "Blue-purple gradients are not allowed.",
          severity: "error"
        });
      }
    }

    const pageBackgroundImagePattern = /background(?:-image)?\s*:\s*[^;{}]*url\(/gi;
    let imageMatch: RegExpExecArray | null;

    while ((imageMatch = pageBackgroundImagePattern.exec(file.content)) !== null) {
      pageImageBackgroundCount += 1;
      findings.push({
        check: "Page background image",
        file: file.relativePath,
        line: lineForIndex(file.content, imageMatch.index),
        message: "background-image: url(...) must not be used for page backgrounds.",
        severity: "error"
      });
    }

    for (const block of extractCssBlocks(file.content)) {
      const backgroundDeclarationPattern = /background(?:-color)?\s*:\s*([^;]+);?/gi;
      let declarationMatch: RegExpExecArray | null;

      while ((declarationMatch = backgroundDeclarationPattern.exec(block.body)) !== null) {
        if (isOrangeBackgroundColor(declarationMatch[1]) && !isAllowedOrangeBackgroundSelector(block.selector)) {
          orangeBackgroundCount += 1;
          findings.push({
            check: "Forbidden colors",
            file: file.relativePath,
            line: lineForIndex(file.content, block.index + declarationMatch.index),
            message: `Large orange backgrounds are not allowed outside brand buttons: ${block.selector}.`,
            severity: "error"
          });
        }
      }
    }
  }

  return [
    {
      name: "High-saturation tech blue",
      reason: techBlueCount === 0
        ? "No high-saturation tech blue colors were found."
        : `${techBlueCount} high-saturation tech blue color usage(s) found.`,
      status: techBlueCount === 0 ? "PASS" : "FAIL"
    },
    {
      name: "Blue-purple gradients",
      reason: bluePurpleGradientCount === 0
        ? "No blue-purple gradient usage was found."
        : `${bluePurpleGradientCount} blue-purple gradient usage(s) found.`,
      status: bluePurpleGradientCount === 0 ? "PASS" : "FAIL"
    },
    {
      name: "Large orange backgrounds",
      reason: orangeBackgroundCount === 0
        ? "#c96442 is only allowed for brand-button backgrounds; no broad orange background usage was found."
        : `${orangeBackgroundCount} broad orange background usage(s) found.`,
      status: orangeBackgroundCount === 0 ? "PASS" : "FAIL"
    },
    {
      name: "Page background images",
      reason: pageImageBackgroundCount === 0
        ? "No background-image: url(...) page background usage was found."
        : `${pageImageBackgroundCount} background image usage(s) found.`,
      status: pageImageBackgroundCount === 0 ? "PASS" : "FAIL"
    },
    {
      name: "Non-token warm page backgrounds",
      reason: nonTokenPageBackgroundCount === 0
        ? "No non-token warm page background colors were found."
        : `${nonTokenPageBackgroundCount} non-token warm page background usage(s) found.`,
      status: nonTokenPageBackgroundCount === 0 ? "PASS" : "FAIL"
    }
  ];
}

function formatFinding(finding: Finding): string {
  const location = finding.file
    ? `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`}`
    : "project";

  return `- ${finding.severity.toUpperCase()} [${finding.check}] ${location} - ${finding.message}`;
}

function buildReport(input: {
  checks: CheckSummary[];
  files: SourceFile[];
  findings: Finding[];
}): string {
  const failedChecks = input.checks.filter((check) => check.status === "FAIL");
  const status = failedChecks.length === 0 ? "PASS" : "FAIL";
  const lines = [
    "# Design Check Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Overall status: ${status}`,
    `Scanned files: ${input.files.length}`,
    "",
    "## Checks",
    "",
    ...input.checks.flatMap((check) => [
      `### ${check.name}`,
      "",
      `Status: ${check.status}`,
      "",
      check.reason,
      ""
    ]),
    "## Findings",
    "",
    input.findings.length === 0 ? "No findings." : input.findings.map(formatFinding).join("\n"),
    "",
    "## Design Reasons",
    "",
    "- Page backgrounds must use #faf9f5 so the public site and admin share the same warm, non-pure-white base.",
    "- High-saturation tech blue and blue-purple gradients are scanned because they conflict with the warm minimal design direction.",
    "- Orange is reserved for brand emphasis. #c96442 is allowed on brand buttons, but broad orange backgrounds would overpower the interface.",
    "- URL-backed background images are scanned because this project intentionally avoids photo and paper-image page backgrounds.",
    "- Button token checks keep primary actions on warm black with warm white text, and brand actions on terracotta with warm white text."
  ];

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const files = (await Promise.all(scanDirectories.map(collectSourceFiles))).flat();
  const findings: Finding[] = [];
  const checks = [
    ...checkPageBackground(files),
    checkButtonTokens(files, findings),
    ...scanForbiddenColors(files, findings)
  ];

  if (checks.some((check) => check.status === "FAIL")) {
    for (const check of checks) {
      if (check.status === "FAIL" && !findings.some((finding) => finding.check === check.name)) {
        findings.push({
          check: check.name,
          message: check.reason,
          severity: "error"
        });
      }
    }
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, buildReport({ checks, files, findings }), "utf8");

  console.log(`Design check report written to ${normalizePath(reportPath)}`);

  if (checks.some((check) => check.status === "FAIL") || findings.some((finding) => finding.severity === "error")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown design token check failure.";
  console.error(message);
  process.exitCode = 1;
});
