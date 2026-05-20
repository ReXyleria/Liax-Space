import { BackupPageContent } from "@/app/console/backup/backup-page";

export const dynamic = "force-dynamic";

export default function ConsoleBackupPage() {
  return <BackupPageContent path="/console/backup" />;
}
