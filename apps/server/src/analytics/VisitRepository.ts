import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";

export type VisitEventInput = {
  locale: string | null;
  path: string;
  country: string;
  deviceType: string;
  ipHash: string | null;
  userAgent: string | null;
  referrer: string | null;
};

export type DailyVisitCount = {
  date: string;
  visits: number;
};

export type VisitDimensionCount = {
  label: string;
  visits: number;
};

export type PopularPage = {
  path: string;
  locale: string | null;
  visits: number;
};

export class VisitRepository {
  async create(input: VisitEventInput): Promise<void> {
    const pool = getDatabasePool();

    await pool.execute<ResultSetHeader>(
      `INSERT INTO visit_events (locale, path, country, device_type, ip_hash, user_agent, referrer)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.locale,
        input.path,
        input.country,
        input.deviceType,
        input.ipHash,
        input.userAgent,
        input.referrer
      ]
    );
  }

  async countSince(startDate: Date): Promise<number> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
      "SELECT COUNT(*) AS total FROM visit_events WHERE visited_at >= ?",
      [startDate]
    );

    return rows[0]?.total ?? 0;
  }

  async listDailyCounts(startDate: Date): Promise<DailyVisitCount[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<Array<RowDataPacket & { day: string; total: number }>>(
      `SELECT DATE(visited_at) AS day, COUNT(*) AS total
       FROM visit_events
       WHERE visited_at >= ?
       GROUP BY DATE(visited_at)
       ORDER BY day ASC`,
      [startDate]
    );

    return rows.map((row) => ({
      date: String(row.day),
      visits: row.total
    }));
  }

  async listCountryCounts(startDate: Date, limit = 8): Promise<VisitDimensionCount[]> {
    const pool = getDatabasePool();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
    const [rows] = await pool.execute<Array<RowDataPacket & { country: string; total: number }>>(
      `SELECT country, COUNT(*) AS total
       FROM visit_events
       WHERE visited_at >= ?
       GROUP BY country
       ORDER BY total DESC, country ASC
       LIMIT ${safeLimit}`,
      [startDate]
    );

    return rows.map((row) => ({
      label: row.country,
      visits: row.total
    }));
  }

  async listDeviceCounts(startDate: Date, limit = 8): Promise<VisitDimensionCount[]> {
    const pool = getDatabasePool();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
    const [rows] = await pool.execute<Array<RowDataPacket & { device_type: string; total: number }>>(
      `SELECT device_type, COUNT(*) AS total
       FROM visit_events
       WHERE visited_at >= ?
       GROUP BY device_type
       ORDER BY total DESC, device_type ASC
       LIMIT ${safeLimit}`,
      [startDate]
    );

    return rows.map((row) => ({
      label: row.device_type,
      visits: row.total
    }));
  }

  async listPopularPages(startDate: Date, limit = 8): Promise<PopularPage[]> {
    const pool = getDatabasePool();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
    const [rows] = await pool.execute<Array<RowDataPacket & { path: string; locale: string | null; total: number }>>(
      `SELECT path, locale, COUNT(*) AS total
       FROM visit_events
       WHERE visited_at >= ?
       GROUP BY path, locale
       ORDER BY total DESC, path ASC
       LIMIT ${safeLimit}`,
      [startDate]
    );

    return rows.map((row) => ({
      locale: row.locale,
      path: row.path,
      visits: row.total
    }));
  }
}
