import type { SupportedLocale } from "../../../../packages/shared/src/locales";

import { httpClient } from "./httpClient";

export type UserPreferences = {
  userId: number;
  locale: SupportedLocale;
  reduced_motion: boolean;
  avatar_attachment_id: number | null;
  avatar_public_url: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserPreferencesResponse = {
  preferences: UserPreferences;
};

export type SiteSettings = Record<string, unknown>;

export type SiteSettingsResponse = {
  settings: SiteSettings;
};

export type PreflightCheckKey = "brokenImages" | "contact" | "homeCopy" | "icp" | "logo" | "testGuestbook";
export type PreflightCheckStatus = "fail" | "pass" | "warning";

export type PreflightCheck = {
  key: PreflightCheckKey;
  status: PreflightCheckStatus;
  count: number;
};

export type PreflightResponse = {
  checks: PreflightCheck[];
  summary: Record<PreflightCheckStatus, number>;
};

export type GuestbookTestEntry = {
  id: number;
  locale: SupportedLocale;
  authorName: string;
  email: string | null;
  content: string;
  notifyOnly: boolean;
  isPublic: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type GuestbookTestDataResponse = {
  count: number;
  entries: GuestbookTestEntry[];
};

export type GuestbookTestDataCleanupResponse = {
  deleted: number;
  remaining: number;
};

export type SeoPushProvider = "baidu" | "google" | "indexnow";
export type SeoPushStatus = "failed" | "skipped" | "success";

export type SeoPushSubmission = {
  id: number;
  provider: SeoPushProvider;
  status: SeoPushStatus;
  submittedCount: number;
  statusCode: number | null;
  requestUrl: string | null;
  message: string | null;
  urls: string[];
  createdAt: string;
};

export type SeoPushSubmissionsResponse = {
  submissions: SeoPushSubmission[];
};

export type MailTemplateKey = "guestbook.notification";
export type MailLogStatus = "failed" | "skipped" | "success";

export type MailTemplate = {
  id: number;
  key: MailTemplateKey;
  locale: SupportedLocale;
  subject: string;
  bodyText: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MailLog = {
  id: number;
  templateKey: string;
  recipient: string;
  subject: string;
  status: MailLogStatus;
  message: string | null;
  providerResponse: string | null;
  relatedType: string | null;
  relatedId: number | null;
  createdAt: string;
};

export type MailTemplatesResponse = {
  templates: MailTemplate[];
};

export type MailTemplateResponse = {
  template: MailTemplate;
};

export type MailLogsResponse = {
  logs: MailLog[];
};

export type UpdateUserPreferencesRequest = {
  avatar_attachment_id?: number | null;
  locale?: SupportedLocale;
  reduced_motion?: boolean;
};

export type TotpSetupResponse = {
  secret: string;
  otpauthUrl: string;
};

export type TotpStatusResponse = {
  enabled: boolean;
};

export type Passkey = {
  id: number;
  credentialId: string;
  signCount: number;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type PasskeyListResponse = {
  passkeys: Passkey[];
};

export type PasskeyRegistrationOptionsResponse = {
  publicKey: {
    challenge: string;
    rp: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      name: string;
      displayName: string;
    };
    pubKeyCredParams: PublicKeyCredentialParameters[];
    timeout: number;
    attestation: AttestationConveyancePreference;
    authenticatorSelection: AuthenticatorSelectionCriteria;
    excludeCredentials: Array<{
      id: string;
      type: PublicKeyCredentialType;
    }>;
  };
};

export type PasskeyResponse = {
  passkey: Passkey;
};

export const settingsApi = {
  getSiteSettings(): Promise<SiteSettingsResponse> {
    return httpClient.get<SiteSettingsResponse>("/admin/settings/site");
  },
  getAppearanceSettings(): Promise<SiteSettingsResponse> {
    return httpClient.get<SiteSettingsResponse>("/admin/settings/appearance");
  },
  updateSiteSettings(input: SiteSettings): Promise<SiteSettingsResponse> {
    return httpClient.patch<SiteSettingsResponse>("/admin/settings/site", input);
  },
  getPreflight(): Promise<PreflightResponse> {
    return httpClient.get<PreflightResponse>("/admin/settings/preflight");
  },
  listGuestbookTestData(): Promise<GuestbookTestDataResponse> {
    return httpClient.get<GuestbookTestDataResponse>("/admin/settings/test-data/guestbook");
  },
  cleanupGuestbookTestData(): Promise<GuestbookTestDataCleanupResponse> {
    return httpClient.post<GuestbookTestDataCleanupResponse>("/admin/settings/test-data/guestbook/cleanup", {});
  },
  listSeoPushSubmissions(): Promise<SeoPushSubmissionsResponse> {
    return httpClient.get<SeoPushSubmissionsResponse>("/admin/seo/push/submissions");
  },
  submitSeoPush(input: { providers?: SeoPushProvider[]; urls?: string[] } = {}): Promise<SeoPushSubmissionsResponse> {
    return httpClient.post<SeoPushSubmissionsResponse>("/admin/seo/push/submit", input);
  },
  listMailTemplates(): Promise<MailTemplatesResponse> {
    return httpClient.get<MailTemplatesResponse>("/admin/mail/templates");
  },
  updateMailTemplate(input: Pick<MailTemplate, "bodyText" | "enabled" | "key" | "locale" | "subject">): Promise<MailTemplateResponse> {
    return httpClient.patch<MailTemplateResponse>(`/admin/mail/templates/${encodeURIComponent(input.key)}/${input.locale}`, {
      bodyText: input.bodyText,
      enabled: input.enabled,
      subject: input.subject
    });
  },
  listMailLogs(): Promise<MailLogsResponse> {
    return httpClient.get<MailLogsResponse>("/admin/mail/logs?limit=50");
  },
  getUserPreferences(): Promise<UserPreferencesResponse> {
    return httpClient.get<UserPreferencesResponse>("/admin/me/preferences");
  },
  updateUserPreferences(input: UpdateUserPreferencesRequest): Promise<UserPreferencesResponse> {
    return httpClient.patch<UserPreferencesResponse>("/admin/me/preferences", input);
  },
  setupTotp(): Promise<TotpSetupResponse> {
    return httpClient.post<TotpSetupResponse>("/auth/totp/setup", {});
  },
  confirmTotp(code: string): Promise<TotpStatusResponse> {
    return httpClient.post<TotpStatusResponse>("/auth/totp/confirm", { code });
  },
  disableTotp(): Promise<TotpStatusResponse> {
    return httpClient.post<TotpStatusResponse>("/auth/totp/disable", {});
  },
  listPasskeys(): Promise<PasskeyListResponse> {
    return httpClient.get<PasskeyListResponse>("/auth/passkeys");
  },
  createPasskeyRegistrationOptions(): Promise<PasskeyRegistrationOptionsResponse> {
    return httpClient.post<PasskeyRegistrationOptionsResponse>("/auth/passkeys/register/options", {});
  },
  verifyPasskeyRegistration(input: { credential: unknown; deviceName?: string | null }): Promise<PasskeyResponse> {
    return httpClient.post<PasskeyResponse>("/auth/passkeys/register/verify", input);
  },
  deletePasskey(passkeyId: number): Promise<{ deleted: true }> {
    return httpClient.delete<{ deleted: true }>(`/auth/passkeys/${passkeyId}`);
  }
};
