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
