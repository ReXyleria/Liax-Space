export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { scheduleStartupCachePrewarm } = await import("@/features/cache/startup-prewarm");
  scheduleStartupCachePrewarm();
}
