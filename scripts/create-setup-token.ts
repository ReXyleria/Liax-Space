import { runServerDistJob } from "./run-server-dist-job.ts";

await runServerDistJob("setup/createSetupToken.js", process.argv.slice(2));
