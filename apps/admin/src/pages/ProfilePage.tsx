import { useEffect, useState, type ChangeEvent, type ReactElement } from "react";
import type { SupportedLocale } from "../../../../packages/shared/src/locales";

import { attachmentApi } from "../api/attachmentApi";
import { settingsApi, type Passkey } from "../api/settingsApi";
import { useLanguageWipe } from "../effects/language-wipe/LanguageWipeProvider";
import { useVerifiedImageUrl } from "../hooks/useVerifiedImageUrl";
import { enUSDictionary } from "../i18n/dictionaries/en-US";
import { zhCNDictionary } from "../i18n/dictionaries/zh-CN";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

type PublicKeyRegistrationOptionsFromApi = Awaited<ReturnType<typeof settingsApi.createPasskeyRegistrationOptions>>["publicKey"];

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toCredentialCreationOptions(input: PublicKeyRegistrationOptionsFromApi): PublicKeyCredentialCreationOptions {
  return {
    ...input,
    challenge: base64UrlToArrayBuffer(input.challenge),
    excludeCredentials: input.excludeCredentials.map((credential) => ({
      ...credential,
      id: base64UrlToArrayBuffer(credential.id)
    })),
    user: {
      ...input.user,
      id: base64UrlToArrayBuffer(input.user.id)
    }
  };
}

function toRegistrationPayload(credential: PublicKeyCredential): unknown {
  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON)
    },
    type: credential.type
  };
}

function isPublicKeyCredential(value: Credential | null): value is PublicKeyCredential {
  return value !== null && value.type === "public-key";
}

function translateForLocale(locale: SupportedLocale, key: keyof typeof zhCNDictionary): string {
  return (locale === "en-US" ? enUSDictionary : zhCNDictionary)[key];
}

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function ProfilePage(): ReactElement {
  const t = useT();
  const { currentLocale, switchLocale } = useLanguageWipe();
  const [locale, setLocale] = useState<SupportedLocale>(currentLocale);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [avatarAttachmentId, setAvatarAttachmentId] = useState<number | null>(null);
  const [avatarPublicUrl, setAvatarPublicUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUrl, setTotpUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const avatarImage = useVerifiedImageUrl(avatarPublicUrl);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [preferencesResponse, passkeysResponse] = await Promise.all([
          settingsApi.getUserPreferences(),
          settingsApi.listPasskeys()
        ]);

        if (isMounted) {
          setLocale(currentLocale);
          setReducedMotion(preferencesResponse.preferences.reduced_motion);
          setAvatarAttachmentId(preferencesResponse.preferences.avatar_attachment_id);
          setAvatarPublicUrl(preferencesResponse.preferences.avatar_public_url);
          setPasskeys(passkeysResponse.passkeys);

          if (preferencesResponse.preferences.locale !== currentLocale) {
            void settingsApi.updateUserPreferences({ locale: currentLocale }).catch(() => {
              // Shared locale cookie already controls this session; persistence can retry on the next save.
            });
          }
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("settings.loadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentLocale, t]);

  async function handleSavePreferences(): Promise<void> {
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.updateUserPreferences({
        locale,
        reduced_motion: reducedMotion
      });

      setLocale(response.preferences.locale);
      setReducedMotion(response.preferences.reduced_motion);
      setAvatarAttachmentId(response.preferences.avatar_attachment_id);
      setAvatarPublicUrl(response.preferences.avatar_public_url);
      switchLocale({ locale: response.preferences.locale });
      setMessage(translateForLocale(response.preferences.locale, "settings.saved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    if (!allowedAvatarTypes.has(file.type)) {
      setErrorMessage(t("profile.avatarUnsupported"));
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const uploadResponse = await attachmentApi.uploadAvatar(file);

      setAvatarAttachmentId(uploadResponse.preferences.avatar_attachment_id);
      setAvatarPublicUrl(uploadResponse.preferences.avatar_public_url ?? uploadResponse.attachment.publicUrl);
      setMessage(t("profile.avatarUploaded"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("profile.avatarUploadFailed"));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleClearAvatar(): Promise<void> {
    setMessage(null);
    setErrorMessage(null);
    setIsUploadingAvatar(true);

    try {
      const preferencesResponse = await settingsApi.updateUserPreferences({
        avatar_attachment_id: null
      });

      setAvatarAttachmentId(preferencesResponse.preferences.avatar_attachment_id);
      setAvatarPublicUrl(preferencesResponse.preferences.avatar_public_url);
      setMessage(t("profile.avatarCleared"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("profile.avatarClearFailed"));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSetupTotp(): Promise<void> {
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.setupTotp();
      setTotpSecret(response.secret);
      setTotpUrl(response.otpauthUrl);
      setMessage(t("settings.totpSetupReady"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.totpSetupFailed"));
    }
  }

  async function handleConfirmTotp(): Promise<void> {
    setMessage(null);
    setErrorMessage(null);

    try {
      await settingsApi.confirmTotp(totpCode);
      setTotpCode("");
      setTotpSecret(null);
      setTotpUrl(null);
      setMessage(t("settings.totpEnabled"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.totpConfirmFailed"));
    }
  }

  async function handleDisableTotp(): Promise<void> {
    setMessage(null);
    setErrorMessage(null);

    try {
      await settingsApi.disableTotp();
      setTotpCode("");
      setTotpSecret(null);
      setTotpUrl(null);
      setMessage(t("settings.totpDisabled"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.totpDisableFailed"));
    }
  }

  async function handleRegisterPasskey(): Promise<void> {
    setMessage(null);
    setErrorMessage(null);

    if (!navigator.credentials) {
      setErrorMessage(t("settings.passkeyUnsupported"));
      return;
    }

    try {
      const optionsResponse = await settingsApi.createPasskeyRegistrationOptions();
      const credential = await navigator.credentials.create({
        publicKey: toCredentialCreationOptions(optionsResponse.publicKey)
      });

      if (!isPublicKeyCredential(credential)) {
        throw new Error(t("settings.passkeyCancelled"));
      }

      const response = await settingsApi.verifyPasskeyRegistration({
        credential: toRegistrationPayload(credential),
        deviceName: deviceName.trim() || null
      });

      setPasskeys((currentPasskeys) => [response.passkey, ...currentPasskeys]);
      setDeviceName("");
      setMessage(t("settings.passkeyRegistered"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.passkeyRegisterFailed"));
    }
  }

  async function handleDeletePasskey(passkeyId: number): Promise<void> {
    setMessage(null);
    setErrorMessage(null);

    try {
      await settingsApi.deletePasskey(passkeyId);
      setPasskeys((currentPasskeys) => currentPasskeys.filter((passkey) => passkey.id !== passkeyId));
      setMessage(t("settings.passkeyDeleted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.passkeyDeleteFailed"));
    }
  }

  return (
    <AdminLayout avatarUrl={avatarPublicUrl}>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("profile.kicker")}</p>
          <h2>{t("profile.title")}</h2>
        </div>
      </section>

      {isLoading ? <p className="admin-muted-text">{t("settings.loading")}</p> : null}

      <section className="admin-settings-grid">
        <article className="liax-card admin-profile-avatar-card">
          <div className="liax-card__header">
            <h3>{t("profile.avatarTitle")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-profile-avatar-panel">
              <div className="admin-profile-avatar-preview" aria-label={t("profile.avatarPreview")} data-status={avatarImage.status}>
                {avatarImage.url ? <img alt="" onError={() => {
                  avatarImage.markFailed();
                }} src={avatarImage.url} /> : <span>LS</span>}
              </div>
              <div className="admin-profile-avatar-meta">
                <p>{t("profile.avatarHelp")}</p>
                <p className="admin-muted-text">
                  {avatarAttachmentId ? `${t("profile.avatarCurrent")} #${avatarAttachmentId}` : t("profile.avatarEmpty")}
                </p>
                <div className="admin-form-actions admin-profile-avatar-actions">
                  <label className="liax-button liax-button--primary admin-avatar-file-label">
                    <input
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="admin-avatar-file-input"
                      disabled={isUploadingAvatar}
                      onChange={(event) => void handleAvatarFileChange(event)}
                      type="file"
                    />
                    <span>{isUploadingAvatar ? t("profile.avatarUploading") : t("profile.avatarUpload")}</span>
                  </label>
                  <button
                    className="liax-button"
                    disabled={isUploadingAvatar || !avatarAttachmentId}
                    onClick={() => void handleClearAvatar()}
                    type="button"
                  >
                    {t("profile.avatarClear")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="liax-card">
          <div className="liax-card__header">
            <h3>{t("settings.preferences")}</h3>
          </div>
          <div className="liax-card__body">
            <label className="admin-form-field">
              <span>{t("settings.locale")}</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as SupportedLocale)}>
                <option value="zh-CN">{t("locale.zhCN")}</option>
                <option value="en-US">{t("locale.enUS")}</option>
              </select>
            </label>
            <label className="admin-checkbox-field">
              <input
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
                type="checkbox"
              />
              <span>{t("settings.reducedMotion")}</span>
            </label>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isSaving} onClick={() => void handleSavePreferences()} type="button">
                {isSaving ? t("settings.saving") : t("settings.save")}
              </button>
            </div>
          </div>
        </article>

        <article className="liax-card">
          <div className="liax-card__header">
            <h3>{t("settings.totp")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-form-actions">
              <button className="liax-button" onClick={() => void handleSetupTotp()} type="button">
                {t("settings.totpSetup")}
              </button>
              <button className="liax-button" onClick={() => void handleDisableTotp()} type="button">
                {t("settings.totpDisable")}
              </button>
            </div>
            {totpSecret ? (
              <div className="admin-code-snippet">
                <p>{t("settings.totpSecret")}</p>
                <code>{totpSecret}</code>
                <p>{t("settings.totpUrl")}</p>
                <code>{totpUrl}</code>
              </div>
            ) : null}
            <label className="admin-form-field">
              <span>{t("settings.totpCode")}</span>
              <input value={totpCode} onChange={(event) => setTotpCode(event.target.value)} />
            </label>
            <button className="liax-button liax-button--primary" onClick={() => void handleConfirmTotp()} type="button">
              {t("settings.totpConfirm")}
            </button>
          </div>
        </article>

        <article className="liax-card">
          <div className="liax-card__header">
            <h3>{t("settings.passkeys")}</h3>
          </div>
          <div className="liax-card__body">
            <label className="admin-form-field">
              <span>{t("settings.passkeyDeviceName")}</span>
              <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} />
            </label>
            <button className="liax-button liax-button--primary" onClick={() => void handleRegisterPasskey()} type="button">
              {t("settings.passkeyRegister")}
            </button>
            <div className="admin-passkey-list">
              {passkeys.length === 0 ? <p className="admin-muted-text">{t("settings.passkeyEmpty")}</p> : null}
              {passkeys.map((passkey) => (
                <section className="admin-passkey-item" key={passkey.id}>
                  <div>
                    <strong>{passkey.deviceName ?? t("settings.passkeyUnnamed")}</strong>
                    <p>{t("settings.passkeyCreated")}: {new Date(passkey.createdAt).toLocaleString()}</p>
                  </div>
                  <button className="liax-button" onClick={() => void handleDeletePasskey(passkey.id)} type="button">
                    {t("settings.passkeyDelete")}
                  </button>
                </section>
              ))}
            </div>
          </div>
        </article>
      </section>

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
    </AdminLayout>
  );
}
