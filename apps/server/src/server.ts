import { loadDotEnv } from "./config/loadDotEnv.js";

loadDotEnv();

const { env } = await import("./config/index.js");

async function prepareProductionRuntime(): Promise<void> {
  const { runMigrations } = await import("./database/migrate.js");
  const { ensureSetupToken } = await import("./setup/createSetupToken.js");

  await runMigrations("latest");

  const setupToken = await ensureSetupToken();

  if (setupToken.status === "created") {
    console.log(`Setup token file created at ${setupToken.setupTokenPath}`);
  }

  if (setupToken.status === "exists") {
    console.log(`Setup token file is available at ${setupToken.setupTokenPath}`);
  }
}

if (env.appEnv === "production") {
  await prepareProductionRuntime();
}

const { createApp } = await import("./app.js");
const app = createApp();

app.listen(env.appPort, env.appHost, () => {
  console.log(`Server listening on http://${env.appHost}:${env.appPort}`);
});
