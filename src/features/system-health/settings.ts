import { db } from "@/lib/db";

export async function readSettings(keys: string[]) {
  const rows = await db.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true }
  });

  return Object.fromEntries(rows.map((row) => [row.key, row.value])) as Record<string, string>;
}
