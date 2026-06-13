export const supportedPreferenceLocales = ["zh-CN", "en-US"] as const;

export type PreferenceLocale = (typeof supportedPreferenceLocales)[number];

export type SiteSettings = Record<string, unknown>;

export type UserPreferences = {
  avatarAttachmentId: number | null;
  avatarPublicUrl: string | null;
  userId: number;
  locale: PreferenceLocale;
  reducedMotion: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateUserPreferencesInput = {
  avatarAttachmentId?: unknown;
  locale?: unknown;
  reducedMotion?: unknown;
};

export function isPreferenceLocale(value: unknown): value is PreferenceLocale {
  return typeof value === "string" && supportedPreferenceLocales.includes(value as PreferenceLocale);
}
