import { BackupPageContent } from "@/app/admin/backup/backup-page";

export const dynamic = "force-dynamic";

export default function AdminDataBackupsPage() {
  return <BackupPageContent path="/admin/data/backups" />;
}
