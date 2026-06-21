import { access } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type { RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import { storagePaths } from "../config/paths.js";
import { GuestbookRepository } from "../guestbook/GuestbookRepository.js";
import type { GuestbookEntry } from "../guestbook/guestbook.types.js";
import { SettingsRepository } from "./SettingsRepository.js";
import { isPlaceholderSiteSettingValue } from "./SiteSettingsService.js";
import type { SiteSettings } from "./settings.types.js";

export type PreflightCheckKey = "brokenImages" | "contact" | "homeCopy" | "icp" | "logo" | "testGuestbook";
export type PreflightCheckStatus = "fail" | "pass" | "warning";

export type PreflightCheck = {
  key: PreflightCheckKey;
  status: PreflightCheckStatus;
  count: number;
};

export type PreflightSummary = {
  fail: number;
  pass: number;
  warning: number;
};

export type PreflightResult = {
  checks: PreflightCheck[];
  summary: PreflightSummary;
};

type AttachmentHealthRow = RowDataPacket & {
  id: number;
  original_filename: string;
  public_url: string | null;
  storage_key: string;
};

function hasSetting(settings: SiteSettings, key: string): boolean {
  const value = settings[key];

  return typeof value === "string" && value.trim().length > 0 && !isPlaceholderSiteSettingValue(key, value);
}

function resolveInsideUploadsDir(storageKey: string): string | null {
  if (!storageKey.startsWith("uploads/")) {
    return null;
  }

  const uploadRoot = resolve(storagePaths.uploadsDir);
  const absolutePath = resolve(uploadRoot, storageKey.slice("uploads/".length));
  const relativePath = relative(uploadRoot, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export class MaintenanceService {
  constructor(
    private readonly settingsRepository = new SettingsRepository(),
    private readonly guestbookRepository = new GuestbookRepository()
  ) {}

  async getPreflight(): Promise<PreflightResult> {
    const [settings, testGuestbookCount, brokenImageCount] = await Promise.all([
      this.settingsRepository.getSiteSettings(),
      this.guestbookRepository.countTestEntries(),
      this.countBrokenImages()
    ]);

    const hasContact = hasSetting(settings, "home.contactItems.en-US") || hasSetting(settings, "home.contactItems.zh-CN") || hasSetting(settings, "home.contactItems");
    const checks: PreflightCheck[] = [
      {
        count: hasSetting(settings, "home.icpNumber") ? 0 : 1,
        key: "icp",
        status: hasSetting(settings, "home.icpNumber") ? "pass" : "warning"
      },
      {
        count: hasContact ? 0 : 1,
        key: "contact",
        status: hasContact ? "pass" : "warning"
      },
      {
        count: hasSetting(settings, "site.logoUrl") ? 0 : 1,
        key: "logo",
        status: hasSetting(settings, "site.logoUrl") ? "pass" : "warning"
      },
      {
        count: hasSetting(settings, "home.signature") && hasSetting(settings, "home.brandInfo") ? 0 : 1,
        key: "homeCopy",
        status: hasSetting(settings, "home.signature") && hasSetting(settings, "home.brandInfo") ? "pass" : "warning"
      },
      {
        count: brokenImageCount,
        key: "brokenImages",
        status: brokenImageCount > 0 ? "fail" : "pass"
      },
      {
        count: testGuestbookCount,
        key: "testGuestbook",
        status: testGuestbookCount > 0 ? "warning" : "pass"
      }
    ];
    const summary = checks.reduce<PreflightSummary>((current, check) => ({
      ...current,
      [check.status]: current[check.status] + 1
    }), { fail: 0, pass: 0, warning: 0 });

    return { checks, summary };
  }

  async listGuestbookTestEntries(): Promise<{ count: number; entries: GuestbookEntry[] }> {
    const [count, entries] = await Promise.all([
      this.guestbookRepository.countTestEntries(),
      this.guestbookRepository.listTestEntries()
    ]);

    return { count, entries };
  }

  async cleanupGuestbookTestEntries(): Promise<{ deleted: number; remaining: number }> {
    const deleted = await this.guestbookRepository.softDeleteTestEntries();
    const remaining = await this.guestbookRepository.countTestEntries();

    return { deleted, remaining };
  }

  private async countBrokenImages(): Promise<number> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<AttachmentHealthRow[]>(
      `SELECT id, original_filename, public_url, storage_key
       FROM attachments
       WHERE deleted_at IS NULL
         AND mime_type LIKE 'image/%'
       LIMIT 500`
    );
    let brokenCount = 0;

    for (const row of rows) {
      if (!row.public_url) {
        brokenCount += 1;
        continue;
      }

      const absolutePath = resolveInsideUploadsDir(row.storage_key);

      if (absolutePath && !(await fileExists(absolutePath))) {
        brokenCount += 1;
      }
    }

    return brokenCount;
  }
}
