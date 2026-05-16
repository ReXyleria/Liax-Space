import { UserRole } from "@prisma/client";
import { createBackup } from "../src/features/backup/service";
import { db, isDatabaseConfigured } from "../src/lib/db";

async function main() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const owner = await db.user.findFirst({
    where: { role: UserRole.Administer },
    select: {
      id: true,
      email: true,
      username: true,
      nickname: true,
      avatar: true,
      role: true,
      status: true,
      mutedUntil: true,
      emailVerified: true,
      totpEnabled: true,
      totpConfirmedAt: true,
      createdAt: true,
      lastLoginAt: true,
      identity: {
        select: {
          id: true,
          key: true,
          name: true,
          builtInRole: true,
          permissions: true
        }
      }
    }
  });

  if (!owner) {
    throw new Error("No Administer user exists for scheduled backup attribution.");
  }

  const backup = await createBackup(owner, "scheduled-cli");
  console.log(`Created backup ${backup.filename}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
