import { useEffect, useState, type ReactElement } from "react";

import { settingsApi } from "../api/settingsApi";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

type HomeSettingsForm = {
  brandInfo: string;
  signature: string;
  contactItemsEn: string;
  contactItemsZh: string;
  icpNumber: string;
  icpUrl: string;
};

type AiSettingsForm = {
  apiKey: string;
  apiKeyConfigured: boolean;
  provider: "deepseek" | "openai" | "ollama";
  baseUrl: string;
  model: string;
  temperature: string;
};

type SmtpEncryption = "none" | "starttls" | "ssl_tls";

type SmtpSettingsForm = {
  encryption: SmtpEncryption;
  from: string;
  fromName: string;
  host: string;
  notificationsEnabled: boolean;
  pass: string;
  passConfigured: boolean;
  port: string;
  user: string;
};

const defaultHomeSettings: HomeSettingsForm = {
  brandInfo: "Liax Space · 温暖极简内容空间",
  contactItemsEn: "Email:hello@example.com\nQQ:123456",
  contactItemsZh: "邮箱:hello@example.com\nQQ:123456",
  icpNumber: "备案号待配置",
  icpUrl: "https://beian.miit.gov.cn",
  signature: "Timeless Silent Vigil"
};

const aiProviderDefaults: Record<AiSettingsForm["provider"], { baseUrl: string; model: string }> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat"
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini"
  }
};

const defaultAiSettings: AiSettingsForm = {
  apiKey: "",
  apiKeyConfigured: false,
  baseUrl: aiProviderDefaults.deepseek.baseUrl,
  model: aiProviderDefaults.deepseek.model,
  provider: "deepseek",
  temperature: "1"
};

const defaultSmtpSettings: SmtpSettingsForm = {
  encryption: "starttls",
  from: "",
  fromName: "",
  host: "",
  notificationsEnabled: true,
  pass: "",
  passConfigured: false,
  port: "587",
  user: ""
};

function readSiteString(settings: Record<string, unknown>, key: string, fallback: string): string {
  const value = settings[key];

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readSiteNumberString(settings: Record<string, unknown>, key: string, fallback: string): string {
  const value = settings[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return value.trim();
  }

  return fallback;
}

function readSiteBoolean(settings: Record<string, unknown>, key: string): boolean {
  return settings[key] === true;
}

function readSiteBooleanWithDefault(settings: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = settings[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string" && ["true", "false"].includes(value)) {
    return value === "true";
  }

  return fallback;
}

function includesCjk(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

function readLegacyEnglishContactItems(settings: Record<string, unknown>): string {
  const legacyValue = readSiteString(settings, "home.contactItems", "");

  return legacyValue && !includesCjk(legacyValue) ? legacyValue : defaultHomeSettings.contactItemsEn;
}

function readAiProvider(settings: Record<string, unknown>): AiSettingsForm["provider"] {
  const value = settings["ai.provider"];

  return value === "openai" || value === "ollama" || value === "deepseek" ? value : "deepseek";
}

function readSmtpEncryption(settings: Record<string, unknown>): SmtpEncryption {
  const value = settings["smtp.encryption"];

  return value === "none" || value === "ssl_tls" || value === "starttls" ? value : "starttls";
}

export function SettingsPage(): ReactElement {
  const t = useT();
  const [homeSettings, setHomeSettings] = useState<HomeSettingsForm>(defaultHomeSettings);
  const [aiSettings, setAiSettings] = useState<AiSettingsForm>(defaultAiSettings);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettingsForm>(defaultSmtpSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const siteSettingsResponse = await settingsApi.getSiteSettings();

        if (isMounted) {
          const provider = readAiProvider(siteSettingsResponse.settings);
          const providerDefaults = aiProviderDefaults[provider];
          setHomeSettings({
            brandInfo: readSiteString(siteSettingsResponse.settings, "home.brandInfo", defaultHomeSettings.brandInfo),
            contactItemsEn: readSiteString(
              siteSettingsResponse.settings,
              "home.contactItems.en-US",
              readLegacyEnglishContactItems(siteSettingsResponse.settings)
            ),
            contactItemsZh: readSiteString(
              siteSettingsResponse.settings,
              "home.contactItems.zh-CN",
              readSiteString(siteSettingsResponse.settings, "home.contactItems", defaultHomeSettings.contactItemsZh)
            ),
            icpNumber: readSiteString(siteSettingsResponse.settings, "home.icpNumber", defaultHomeSettings.icpNumber),
            icpUrl: readSiteString(siteSettingsResponse.settings, "home.icpUrl", defaultHomeSettings.icpUrl),
            signature: readSiteString(siteSettingsResponse.settings, "home.signature", defaultHomeSettings.signature)
          });
          setAiSettings({
            apiKey: "",
            apiKeyConfigured: readSiteBoolean(siteSettingsResponse.settings, "ai.apiKeyConfigured"),
            baseUrl: readSiteString(
              siteSettingsResponse.settings,
              "ai.baseUrl",
              readSiteString(siteSettingsResponse.settings, "ai.deepseekBaseUrl", providerDefaults.baseUrl)
            ),
            model: readSiteString(
              siteSettingsResponse.settings,
              "ai.model",
              readSiteString(siteSettingsResponse.settings, "ai.deepseekModel", providerDefaults.model)
            ),
            provider,
            temperature: readSiteNumberString(siteSettingsResponse.settings, "ai.translationTemperature", defaultAiSettings.temperature)
          });
          setSmtpSettings({
            encryption: readSmtpEncryption(siteSettingsResponse.settings),
            from: readSiteString(siteSettingsResponse.settings, "smtp.from", defaultSmtpSettings.from),
            fromName: readSiteString(siteSettingsResponse.settings, "smtp.fromName", defaultSmtpSettings.fromName),
            host: readSiteString(siteSettingsResponse.settings, "smtp.host", defaultSmtpSettings.host),
            notificationsEnabled: readSiteBooleanWithDefault(
              siteSettingsResponse.settings,
              "smtp.notificationsEnabled",
              defaultSmtpSettings.notificationsEnabled
            ),
            pass: "",
            passConfigured: readSiteBoolean(siteSettingsResponse.settings, "smtp.passConfigured"),
            port: readSiteNumberString(siteSettingsResponse.settings, "smtp.port", defaultSmtpSettings.port),
            user: readSiteString(siteSettingsResponse.settings, "smtp.user", defaultSmtpSettings.user)
          });
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

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [t]);

  async function handleSaveHomeSettings(): Promise<void> {
    setIsSavingSite(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.updateSiteSettings({
        "home.brandInfo": homeSettings.brandInfo.trim(),
        "home.contactItems.en-US": homeSettings.contactItemsEn.trim(),
        "home.contactItems.zh-CN": homeSettings.contactItemsZh.trim(),
        "home.icpNumber": homeSettings.icpNumber.trim(),
        "home.icpUrl": homeSettings.icpUrl.trim(),
        "home.signature": homeSettings.signature.trim()
      });

      setHomeSettings({
        brandInfo: readSiteString(response.settings, "home.brandInfo", defaultHomeSettings.brandInfo),
        contactItemsEn: readSiteString(response.settings, "home.contactItems.en-US", defaultHomeSettings.contactItemsEn),
        contactItemsZh: readSiteString(response.settings, "home.contactItems.zh-CN", defaultHomeSettings.contactItemsZh),
        icpNumber: readSiteString(response.settings, "home.icpNumber", defaultHomeSettings.icpNumber),
        icpUrl: readSiteString(response.settings, "home.icpUrl", defaultHomeSettings.icpUrl),
        signature: readSiteString(response.settings, "home.signature", defaultHomeSettings.signature)
      });
      setMessage(t("settings.siteSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.siteSaveFailed"));
    } finally {
      setIsSavingSite(false);
    }
  }

  async function handleSaveAiSettings(): Promise<void> {
    const temperature = Number(aiSettings.temperature);

    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      setErrorMessage(t("settings.aiTemperatureInvalid"));
      return;
    }

    setIsSavingAi(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const patch: Record<string, string | number> = {
        "ai.baseUrl": aiSettings.baseUrl.trim(),
        "ai.model": aiSettings.model.trim(),
        "ai.provider": aiSettings.provider,
        "ai.translationTemperature": temperature
      };

      if (aiSettings.apiKey.trim()) {
        patch["ai.apiKey"] = aiSettings.apiKey.trim();
      }

      const response = await settingsApi.updateSiteSettings(patch);
      const provider = readAiProvider(response.settings);
      const providerDefaults = aiProviderDefaults[provider];

      setAiSettings({
        apiKey: "",
        apiKeyConfigured: readSiteBoolean(response.settings, "ai.apiKeyConfigured"),
        baseUrl: readSiteString(response.settings, "ai.baseUrl", providerDefaults.baseUrl),
        model: readSiteString(response.settings, "ai.model", providerDefaults.model),
        provider,
        temperature: readSiteNumberString(response.settings, "ai.translationTemperature", defaultAiSettings.temperature)
      });
      setMessage(t("settings.aiSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.aiSaveFailed"));
    } finally {
      setIsSavingAi(false);
    }
  }

  async function handleSaveSmtpSettings(): Promise<void> {
    const port = Number(smtpSettings.port);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setErrorMessage(t("settings.smtpPortInvalid"));
      return;
    }

    setIsSavingSmtp(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const patch: Record<string, boolean | number | string> = {
        "smtp.encryption": smtpSettings.encryption,
        "smtp.from": smtpSettings.from.trim(),
        "smtp.fromName": smtpSettings.fromName.trim(),
        "smtp.host": smtpSettings.host.trim(),
        "smtp.notificationsEnabled": smtpSettings.notificationsEnabled,
        "smtp.port": port,
        "smtp.user": smtpSettings.user.trim()
      };

      if (smtpSettings.pass.trim()) {
        patch["smtp.pass"] = smtpSettings.pass.trim();
      }

      const response = await settingsApi.updateSiteSettings(patch);

      setSmtpSettings({
        encryption: readSmtpEncryption(response.settings),
        from: readSiteString(response.settings, "smtp.from", defaultSmtpSettings.from),
        fromName: readSiteString(response.settings, "smtp.fromName", defaultSmtpSettings.fromName),
        host: readSiteString(response.settings, "smtp.host", defaultSmtpSettings.host),
        notificationsEnabled: readSiteBooleanWithDefault(response.settings, "smtp.notificationsEnabled", defaultSmtpSettings.notificationsEnabled),
        pass: "",
        passConfigured: readSiteBoolean(response.settings, "smtp.passConfigured"),
        port: readSiteNumberString(response.settings, "smtp.port", defaultSmtpSettings.port),
        user: readSiteString(response.settings, "smtp.user", defaultSmtpSettings.user)
      });
      setMessage(t("settings.smtpSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.smtpSaveFailed"));
    } finally {
      setIsSavingSmtp(false);
    }
  }

  function handleProviderChange(provider: AiSettingsForm["provider"]): void {
    const providerDefaults = aiProviderDefaults[provider];
    setAiSettings((current) => ({
      ...current,
      baseUrl: providerDefaults.baseUrl,
      model: providerDefaults.model,
      provider
    }));
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("settings.kicker")}</p>
          <h2>{t("settings.site")}</h2>
        </div>
      </section>

      {isLoading ? <p className="admin-muted-text">{t("settings.loading")}</p> : null}

      <section className="admin-section-heading">
        <h3>{t("settings.system")}</h3>
      </section>

      <section className="admin-settings-grid admin-single-column">
        <article className="liax-card">
          <div className="liax-card__header">
            <h3>{t("settings.home")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-home-settings-grid">
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.homeSignature")}</span>
                <input
                  value={homeSettings.signature}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, signature: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeBrandInfo")}</span>
                <input
                  value={homeSettings.brandInfo}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, brandInfo: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeIcpNumber")}</span>
                <input
                  value={homeSettings.icpNumber}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, icpNumber: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeIcpUrl")}</span>
                <input
                  type="url"
                  value={homeSettings.icpUrl}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, icpUrl: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeContactItemsZh")}</span>
                <textarea
                  rows={4}
                  value={homeSettings.contactItemsZh}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, contactItemsZh: event.target.value }))}
                />
                <small>{t("settings.homeContactItemsZhHelp")}</small>
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeContactItemsEn")}</span>
                <textarea
                  rows={4}
                  value={homeSettings.contactItemsEn}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, contactItemsEn: event.target.value }))}
                />
                <small>{t("settings.homeContactItemsEnHelp")}</small>
              </label>
            </div>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isSavingSite} onClick={() => void handleSaveHomeSettings()} type="button">
                {isSavingSite ? t("settings.saving") : t("settings.save")}
              </button>
            </div>
          </div>
        </article>

        <article className="liax-card">
          <div className="liax-card__header">
            <h3>{t("settings.ai")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-home-settings-grid">
              <label className="admin-form-field">
                <span>{t("settings.aiProvider")}</span>
                <select
                  onChange={(event) => handleProviderChange(event.target.value as AiSettingsForm["provider"])}
                  value={aiSettings.provider}
                >
                  <option value="deepseek">{t("settings.aiProviderDeepSeek")}</option>
                  <option value="openai">{t("settings.aiProviderOpenAI")}</option>
                  <option value="ollama">{t("settings.aiProviderOllama")}</option>
                </select>
              </label>
              <label className="admin-form-field">
                <span>{t("settings.aiTemperature")}</span>
                <input
                  max="2"
                  min="0"
                  onChange={(event) => setAiSettings((current) => ({ ...current, temperature: event.target.value }))}
                  step="0.1"
                  type="number"
                  value={aiSettings.temperature}
                />
              </label>
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.aiApiKey")}</span>
                <input
                  autoComplete="off"
                  type="password"
                  value={aiSettings.apiKey}
                  onChange={(event) => setAiSettings((current) => ({ ...current, apiKey: event.target.value }))}
                />
                <small>
                  {aiSettings.provider === "ollama"
                    ? t("settings.aiApiKeyOllamaHelp")
                    : aiSettings.apiKeyConfigured
                      ? t("settings.aiApiKeyConfiguredHelp")
                      : t("settings.aiApiKeyHelp")}
                </small>
              </label>
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.aiBaseUrl")}</span>
                <input
                  type="url"
                  value={aiSettings.baseUrl}
                  onChange={(event) => setAiSettings((current) => ({ ...current, baseUrl: event.target.value }))}
                />
              </label>
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.aiModel")}</span>
                <input
                  value={aiSettings.model}
                  onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))}
                />
                <small>{t("settings.aiModelHelp")}</small>
              </label>
            </div>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isSavingAi} onClick={() => void handleSaveAiSettings()} type="button">
                {isSavingAi ? t("settings.saving") : t("settings.aiSave")}
              </button>
            </div>
          </div>
        </article>

        <article className="liax-card">
          <div className="liax-card__header">
            <h3>{t("settings.smtp")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-home-settings-grid">
              <label className="admin-form-field">
                <span>{t("settings.smtpHost")}</span>
                <input
                  value={smtpSettings.host}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, host: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpPort")}</span>
                <input
                  inputMode="numeric"
                  max="65535"
                  min="1"
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, port: event.target.value }))}
                  type="number"
                  value={smtpSettings.port}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpUser")}</span>
                <input
                  autoComplete="username"
                  value={smtpSettings.user}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, user: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpPass")}</span>
                <input
                  autoComplete="new-password"
                  type="password"
                  value={smtpSettings.pass}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, pass: event.target.value }))}
                />
                {smtpSettings.passConfigured ? <small>{t("settings.smtpPassConfiguredHelp")}</small> : null}
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpFrom")}</span>
                <input
                  type="email"
                  value={smtpSettings.from}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, from: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpFromName")}</span>
                <input
                  value={smtpSettings.fromName}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, fromName: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpEncryption")}</span>
                <select
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, encryption: event.target.value as SmtpEncryption }))}
                  value={smtpSettings.encryption}
                >
                  <option value="starttls">{t("settings.smtpEncryptionStartTls")}</option>
                  <option value="ssl_tls">{t("settings.smtpEncryptionSslTls")}</option>
                  <option value="none">{t("settings.smtpEncryptionNone")}</option>
                </select>
              </label>
              <label className="admin-toggle-row admin-home-settings-grid__wide">
                <input
                  checked={smtpSettings.notificationsEnabled}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, notificationsEnabled: event.target.checked }))}
                  type="checkbox"
                />
                <span>{t("settings.smtpNotificationsEnabled")}</span>
              </label>
            </div>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isSavingSmtp} onClick={() => void handleSaveSmtpSettings()} type="button">
                {isSavingSmtp ? t("settings.saving") : t("settings.smtpSave")}
              </button>
            </div>
          </div>
        </article>
      </section>

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
    </AdminLayout>
  );
}
