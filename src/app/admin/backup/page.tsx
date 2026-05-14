import { BackupPageContent } from "@/app/admin/backup/backup-page";

export const dynamic = "force-dynamic";

export default function AdminBackupPage() {
  return <BackupPageContent path="/admin/backup" />;
}
