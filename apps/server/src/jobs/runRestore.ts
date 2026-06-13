import { RestoreJob } from "./RestoreJob.js";

function readValueArg(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const backupDir = readValueArg(argv, "backup-dir");

  if (!backupDir) {
    throw new Error("Restore requires --backup-dir=<path>.");
  }

  const result = await new RestoreJob().run({
    backupDir,
    confirmRestore: argv.includes("--confirm-restore")
  });

  console.log(JSON.stringify({
    backupDir: result.backupDir,
    nextStep: result.nextStep,
    restoredMysql: result.restoredMysql,
    restoredUploads: result.restoredUploads
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown restore failure.");
  process.exitCode = 1;
});
