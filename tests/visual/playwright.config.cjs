const { createRequire } = require("node:module");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const adminRoot = path.join(projectRoot, "apps", "admin");
const serverRoot = path.join(projectRoot, "apps", "server");
const adminRequire = createRequire(path.join(adminRoot, "package.json"));
const { defineConfig } = adminRequire("@playwright/test");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

module.exports = defineConfig({
  outputDir: path.join(projectRoot, "test-results", "visual"),
  testDir: __dirname,
  testMatch: /.*\.spec\.ts/,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: {
      height: 720,
      width: 1280
    }
  },
  webServer: [
    {
      command: `${npmCommand} run dev -- --host 127.0.0.1 --port 5173`,
      cwd: adminRoot,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:5173"
    },
    {
      command: `${npmCommand} run dev`,
      cwd: serverRoot,
      env: {
        ...process.env,
        APP_ENV: "development",
        APP_HOST: "127.0.0.1",
        APP_PORT: "3817",
        PUBLIC_BASE_URL: "http://127.0.0.1:3817"
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:3817/health"
    }
  ]
});
