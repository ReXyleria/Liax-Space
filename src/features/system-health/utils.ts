import type { SystemHealthStatus } from "@/features/system-health/types";

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function worstStatus(statuses: SystemHealthStatus[]): SystemHealthStatus {
  if (statuses.includes("critical")) {
    return "critical";
  }
  if (statuses.includes("warning")) {
    return "warning";
  }
  return "ok";
}

export function countByStatus<T extends string>(
  statuses: readonly T[],
  rows: Array<{ status: T; _count: { _all: number } }>
) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<T, number>;
  for (const row of rows) {
    counts[row.status] = row._count._all;
  }
  return counts;
}
