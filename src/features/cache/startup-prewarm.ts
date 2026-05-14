import { prewarmPublicCache } from "@/features/cache/prewarm";

const globalForPrewarm = globalThis as typeof globalThis & {
  __simpleBlogCachePrewarm?: {
    running: boolean;
    lastStartedAt: number;
  };
};

const state = globalForPrewarm.__simpleBlogCachePrewarm ?? {
  running: false,
  lastStartedAt: 0
};

globalForPrewarm.__simpleBlogCachePrewarm = state;

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return value !== "false" && value !== "0" && value !== "off";
}

function readNumberEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function startupBaseUrl() {
  const configured = process.env.CACHE_PREWARM_BASE_URL || process.env.APP_INTERNAL_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return `http://127.0.0.1:${process.env.PORT || "3000"}`;
}

export function scheduleStartupCachePrewarm() {
  if (!readBooleanEnv("CACHE_PREWARM_ON_START", true)) {
    return;
  }

  const cooldownMs = readNumberEnv("CACHE_PREWARM_COOLDOWN_MS", 10 * 60 * 1000, 30_000, 60 * 60 * 1000);
  const now = Date.now();
  if (state.running || now - state.lastStartedAt < cooldownMs) {
    return;
  }

  state.running = true;
  state.lastStartedAt = now;

  const delayMs = readNumberEnv("CACHE_PREWARM_DELAY_MS", 3000, 0, 120_000);
  const limit = readNumberEnv("CACHE_PREWARM_LIMIT", 50, 1, 300);
  const concurrency = readNumberEnv("CACHE_PREWARM_CONCURRENCY", 4, 1, 8);
  const maxAttempts = readNumberEnv("CACHE_PREWARM_MAX_ATTEMPTS", 6, 1, 20);
  const retryDelayMs = readNumberEnv("CACHE_PREWARM_RETRY_DELAY_MS", 3000, 500, 60_000);

  setTimeout(() => {
    void runStartupPrewarm({ limit, concurrency, maxAttempts, retryDelayMs, baseUrl: startupBaseUrl() });
  }, delayMs);
}

async function runStartupPrewarm({
  limit,
  concurrency,
  maxAttempts,
  retryDelayMs,
  baseUrl
}: {
  limit: number;
  concurrency: number;
  maxAttempts: number;
  retryDelayMs: number;
  baseUrl: string;
}) {
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const ready = await isServerReady(baseUrl);
      if (!ready) {
        console.info(`[cache-prewarm] server not ready, retrying (${attempt}/${maxAttempts}).`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      const result = await prewarmPublicCache(limit, { concurrency, baseUrl });
      if (result.success > 0 || result.total === 0 || attempt === maxAttempts) {
        console.info(
          `[cache-prewarm] finished: ${result.success}/${result.total} paths from ${result.baseUrl} in ${result.durationMs}ms.`
        );
        if (result.failed.length) {
          console.warn("[cache-prewarm] failed paths:", result.failed.slice(0, 10));
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  } catch (error) {
    console.error("[cache-prewarm] failed", error);
  } finally {
    state.running = false;
  }
}

async function isServerReady(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        "User-Agent": "liax_space-cache-prewarm/1.0",
        "X-Cache-Prewarm": "1"
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}
