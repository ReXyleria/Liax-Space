import { BackupJob } from "./BackupJob.js";

function readValueArg(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const backupRootDir = readValueArg(process.argv.slice(2), "output-dir");
  const result = await new BackupJob().run({ backupRootDir });

  console.log(JSON.stringify({
    backupDir: result.backupDir,
    manifestPath: result.manifestPath,
    mysqlDumpPath: result.mysqlDumpPath,
    renderedBackedUp: result.renderedBackedUp,
    uploadsBackupDir: result.uploadsBackupDir
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown backup failure.");
  process.exitCode = 1;
});
