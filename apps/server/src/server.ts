import { loadDotEnv } from "./config/loadDotEnv.js";

loadDotEnv();

const { createApp } = await import("./app.js");
const { env } = await import("./config/index.js");

const app = createApp();

app.listen(env.appPort, env.appHost, () => {
  console.log(`Server listening on http://${env.appHost}:${env.appPort}`);
});
