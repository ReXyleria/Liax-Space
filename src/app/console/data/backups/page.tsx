import { BackupPageContent } from "@/app/console/backup/backup-page";

export const dynamic = "force-dynamic";

export default function ConsoleDataBackupsPage() {
  return <BackupPageContent path="/console/data/backups" />;
}
