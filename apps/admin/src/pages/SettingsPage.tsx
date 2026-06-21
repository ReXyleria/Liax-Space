import { useEffect, useState, type ChangeEvent, type ReactElement } from "react";

import { attachmentApi } from "../api/attachmentApi";
import { buildApiUrl } from "../api/httpClient";
import { settingsApi, type GuestbookTestEntry, type MailLog, type MailTemplate, type PreflightCheck, type PreflightCheckStatus, type SeoPushProvider, type SeoPushSubmission } from "../api/settingsApi";
import { useVerifiedImageUrl } from "../hooks/useVerifiedImageUrl";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";
import { notifySiteAppearanceUpdated } from "../theme/siteTheme";

type HomeSettingsForm = {
  brandInfo: string;
  signature: string;
  contactItemsEn: string;
  contactItemsZh: string;
  icpNumber: string;
  icpUrl: string;
  injectionContentHead: string;
  injectionFooter: string;
  injectionGlobalHead: string;
  logoAlt: string;
  logoUrl: string;
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

type SeoPushProviderSettings = {
  enabled: boolean;
  key: string;
  site: string;
  url: string;
};

type SeoPushSettingsForm = Record<SeoPushProvider, SeoPushProviderSettings>;

const defaultHomeSettings: HomeSettingsForm = {
  brandInfo: "Liax Space",
  contactItemsEn: "",
  contactItemsZh: "",
  icpNumber: "",
  icpUrl: "https://beian.miit.gov.cn",
  injectionContentHead: "",
  injectionFooter: "",
  injectionGlobalHead: "",
  logoAlt: "Liax Space",
  logoUrl: "",
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

const defaultSeoPushSettings: SeoPushSettingsForm = {
  baidu: {
    enabled: false,
    key: "",
    site: "",
    url: ""
  },
  google: {
    enabled: false,
    key: "",
    site: "",
    url: "https://indexing.googleapis.com/v3/urlNotifications:publish"
  },
  indexnow: {
    enabled: false,
    key: "",
    site: "",
    url: "https://api.indexnow.org/indexnow"
  }
};

const allowedLogoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function resolveLogoPreviewUrl(value: string): string {
  const normalized = value.trim();

  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    return buildApiUrl(normalized);
  }

  return normalized;
}

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

function readSeoPushSettings(settings: Record<string, unknown>): SeoPushSettingsForm {
  return {
    baidu: {
      enabled: readSiteBooleanWithDefault(settings, "seoPush.baidu.enabled", defaultSeoPushSettings.baidu.enabled),
      key: readSiteString(settings, "seoPush.baidu.key", defaultSeoPushSettings.baidu.key),
      site: readSiteString(settings, "seoPush.baidu.site", defaultSeoPushSettings.baidu.site),
      url: readSiteString(settings, "seoPush.baidu.url", defaultSeoPushSettings.baidu.url)
    },
    google: {
      enabled: readSiteBooleanWithDefault(settings, "seoPush.google.enabled", defaultSeoPushSettings.google.enabled),
      key: readSiteString(settings, "seoPush.google.key", defaultSeoPushSettings.google.key),
      site: readSiteString(settings, "seoPush.google.site", defaultSeoPushSettings.google.site),
      url: readSiteString(settings, "seoPush.google.url", defaultSeoPushSettings.google.url)
    },
    indexnow: {
      enabled: readSiteBooleanWithDefault(settings, "seoPush.indexnow.enabled", defaultSeoPushSettings.indexnow.enabled),
      key: readSiteString(settings, "seoPush.indexnow.key", defaultSeoPushSettings.indexnow.key),
      site: readSiteString(settings, "seoPush.indexnow.site", defaultSeoPushSettings.indexnow.site),
      url: readSiteString(settings, "seoPush.indexnow.url", defaultSeoPushSettings.indexnow.url)
    }
  };
}

function formatSeoPushProvider(provider: SeoPushProvider): string {
  if (provider === "baidu") {
    return "Baidu";
  }

  if (provider === "indexnow") {
    return "Bing/IndexNow";
  }

  return "Google";
}

type SettingsPanel = "ai" | "code" | "mail" | "maintenance" | "seo" | "site";

export function SettingsPage(): ReactElement {
  const t = useT();
  const [homeSettings, setHomeSettings] = useState<HomeSettingsForm>(defaultHomeSettings);
  const [aiSettings, setAiSettings] = useState<AiSettingsForm>(defaultAiSettings);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettingsForm>(defaultSmtpSettings);
  const [seoPushSettings, setSeoPushSettings] = useState<SeoPushSettingsForm>(defaultSeoPushSettings);
  const [seoPushSubmissions, setSeoPushSubmissions] = useState<SeoPushSubmission[]>([]);
  const [preflightChecks, setPreflightChecks] = useState<PreflightCheck[]>([]);
  const [preflightSummary, setPreflightSummary] = useState<Record<PreflightCheckStatus, number>>({ fail: 0, pass: 0, warning: 0 });
  const [testDataEntries, setTestDataEntries] = useState<GuestbookTestEntry[]>([]);
  const [testDataCount, setTestDataCount] = useState(0);
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const [mailLogs, setMailLogs] = useState<MailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isSavingSeoPush, setIsSavingSeoPush] = useState(false);
  const [isSubmittingSeoPush, setIsSubmittingSeoPush] = useState(false);
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);
  const [isCleaningTestData, setIsCleaningTestData] = useState(false);
  const [savingMailTemplateId, setSavingMailTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SettingsPanel>("site");
  const isSiteFormDisabled = isLoading || isSavingSite || isUploadingLogo;
  const isAiFormDisabled = isLoading || isSavingAi;
  const isSmtpFormDisabled = isLoading || isSavingSmtp;
  const isSeoPushFormDisabled = isLoading || isSavingSeoPush || isSubmittingSeoPush;
  const isMaintenanceDisabled = isLoading || isRunningPreflight || isCleaningTestData;
  const logoPreviewUrl = homeSettings.logoUrl ? resolveLogoPreviewUrl(homeSettings.logoUrl) : null;
  const logoPreviewImage = useVerifiedImageUrl(logoPreviewUrl);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [siteSettingsResponse, seoPushResponse, mailTemplatesResponse, mailLogsResponse, preflightResponse, testDataResponse] = await Promise.all([
          settingsApi.getSiteSettings(),
          settingsApi.listSeoPushSubmissions(),
          settingsApi.listMailTemplates(),
          settingsApi.listMailLogs(),
          settingsApi.getPreflight(),
          settingsApi.listGuestbookTestData()
        ]);

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
            injectionContentHead: readSiteString(siteSettingsResponse.settings, "codeInjection.contentHead", defaultHomeSettings.injectionContentHead),
            injectionFooter: readSiteString(siteSettingsResponse.settings, "codeInjection.footer", defaultHomeSettings.injectionFooter),
            injectionGlobalHead: readSiteString(siteSettingsResponse.settings, "codeInjection.globalHead", defaultHomeSettings.injectionGlobalHead),
            logoAlt: readSiteString(siteSettingsResponse.settings, "site.logoAlt", defaultHomeSettings.logoAlt),
            logoUrl: readSiteString(siteSettingsResponse.settings, "site.logoUrl", defaultHomeSettings.logoUrl),
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
          setSeoPushSettings(readSeoPushSettings(siteSettingsResponse.settings));
          setSeoPushSubmissions(seoPushResponse.submissions);
          setPreflightChecks(preflightResponse.checks);
          setPreflightSummary(preflightResponse.summary);
          setTestDataEntries(testDataResponse.entries);
          setTestDataCount(testDataResponse.count);
          setMailTemplates(mailTemplatesResponse.templates);
          setMailLogs(mailLogsResponse.logs);
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

  async function handleSaveHomeSettings(successMessageKey = "settings.siteSaved"): Promise<void> {
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
        "home.signature": homeSettings.signature.trim(),
        "codeInjection.contentHead": homeSettings.injectionContentHead.trim(),
        "codeInjection.footer": homeSettings.injectionFooter.trim(),
        "codeInjection.globalHead": homeSettings.injectionGlobalHead.trim(),
        "site.logoAlt": homeSettings.logoAlt.trim(),
        "site.logoUrl": homeSettings.logoUrl.trim()
      });
      notifySiteAppearanceUpdated(response.settings);

      setHomeSettings({
        brandInfo: readSiteString(response.settings, "home.brandInfo", defaultHomeSettings.brandInfo),
        contactItemsEn: readSiteString(response.settings, "home.contactItems.en-US", defaultHomeSettings.contactItemsEn),
        contactItemsZh: readSiteString(response.settings, "home.contactItems.zh-CN", defaultHomeSettings.contactItemsZh),
        icpNumber: readSiteString(response.settings, "home.icpNumber", defaultHomeSettings.icpNumber),
        icpUrl: readSiteString(response.settings, "home.icpUrl", defaultHomeSettings.icpUrl),
        injectionContentHead: readSiteString(response.settings, "codeInjection.contentHead", defaultHomeSettings.injectionContentHead),
        injectionFooter: readSiteString(response.settings, "codeInjection.footer", defaultHomeSettings.injectionFooter),
        injectionGlobalHead: readSiteString(response.settings, "codeInjection.globalHead", defaultHomeSettings.injectionGlobalHead),
        logoAlt: readSiteString(response.settings, "site.logoAlt", defaultHomeSettings.logoAlt),
        logoUrl: readSiteString(response.settings, "site.logoUrl", defaultHomeSettings.logoUrl),
        signature: readSiteString(response.settings, "home.signature", defaultHomeSettings.signature)
      });
      setMessage(t(successMessageKey));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.siteSaveFailed"));
    } finally {
      setIsSavingSite(false);
    }
  }

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    if (!allowedLogoTypes.has(file.type)) {
      setErrorMessage(t("settings.siteLogoUnsupported"));
      return;
    }

    setIsUploadingLogo(true);

    try {
      const response = await attachmentApi.uploadAttachment(file);

      if (!response.attachment.publicUrl) {
        throw new Error(t("settings.siteLogoUploadFailed"));
      }

      setHomeSettings((current) => ({
        ...current,
        logoUrl: response.attachment.publicUrl ?? ""
      }));
      setMessage(t("settings.siteLogoUploaded"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.siteLogoUploadFailed"));
    } finally {
      setIsUploadingLogo(false);
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

  async function handleSaveSeoPushSettings(): Promise<void> {
    setIsSavingSeoPush(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const patch: Record<string, boolean | string> = {};

      (Object.keys(seoPushSettings) as SeoPushProvider[]).forEach((provider) => {
        const config = seoPushSettings[provider];
        patch[`seoPush.${provider}.enabled`] = config.enabled;
        patch[`seoPush.${provider}.key`] = config.key.trim();
        patch[`seoPush.${provider}.site`] = config.site.trim();
        patch[`seoPush.${provider}.url`] = config.url.trim();
      });

      const response = await settingsApi.updateSiteSettings(patch);
      setSeoPushSettings(readSeoPushSettings(response.settings));
      setMessage(t("settings.seoPushSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.seoPushSaveFailed"));
    } finally {
      setIsSavingSeoPush(false);
    }
  }

  async function handleSubmitSeoPush(): Promise<void> {
    setIsSubmittingSeoPush(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.submitSeoPush();
      const logs = await settingsApi.listSeoPushSubmissions();
      setSeoPushSubmissions(logs.submissions);
      setMessage(response.submissions.length > 0 ? t("settings.seoPushSubmitted") : t("settings.seoPushSubmittedEmpty"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.seoPushSubmitFailed"));
    } finally {
      setIsSubmittingSeoPush(false);
    }
  }

  async function handleRunPreflight(): Promise<void> {
    setIsRunningPreflight(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.getPreflight();
      setPreflightChecks(response.checks);
      setPreflightSummary(response.summary);
      setMessage(t("settings.preflightCompleted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.preflightFailed"));
    } finally {
      setIsRunningPreflight(false);
    }
  }

  async function refreshGuestbookTestData(): Promise<void> {
    const response = await settingsApi.listGuestbookTestData();
    setTestDataEntries(response.entries);
    setTestDataCount(response.count);
  }

  async function handleCleanupGuestbookTestData(): Promise<void> {
    if (testDataCount > 0 && !window.confirm(t("settings.testDataCleanupConfirm"))) {
      return;
    }

    setIsCleaningTestData(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.cleanupGuestbookTestData();
      await refreshGuestbookTestData();
      const preflightResponse = await settingsApi.getPreflight();
      setPreflightChecks(preflightResponse.checks);
      setPreflightSummary(preflightResponse.summary);
      setMessage(t("settings.testDataCleaned").replace("{count}", String(response.deleted)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.testDataCleanupFailed"));
    } finally {
      setIsCleaningTestData(false);
    }
  }
function updateMailTemplate(templateId: number, patch: Partial<Pick<MailTemplate, "bodyText" | "enabled" | "subject">>): void {
    setMailTemplates((current) => current.map((template) => (
      template.id === templateId
        ? {
          ...template,
          ...patch
        }
        : template
    )));
  }

  async function handleSaveMailTemplate(template: MailTemplate): Promise<void> {
    const templateId = `${template.key}:${template.locale}`;
    setSavingMailTemplateId(templateId);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.updateMailTemplate({
        bodyText: template.bodyText.trim(),
        enabled: template.enabled,
        key: template.key,
        locale: template.locale,
        subject: template.subject.trim()
      });
      const logs = await settingsApi.listMailLogs();
      setMailTemplates((current) => current.map((item) => (item.id === response.template.id ? response.template : item)));
      setMailLogs(logs.logs);
      setMessage(t("settings.mailTemplateSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.mailTemplateSaveFailed"));
    } finally {
      setSavingMailTemplateId(null);
    }
  }

  function updateSeoPushProvider(provider: SeoPushProvider, patch: Partial<SeoPushProviderSettings>): void {
    setSeoPushSettings((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        ...patch
      }
    }));
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

      <nav className="admin-settings-tabs" aria-label={t("settings.tabs")}>
        {([
          ["site", "settings.tab.public"],
          ["code", "settings.tab.code"],
          ["ai", "settings.tab.ai"],
          ["mail", "settings.tab.mail"],
          ["seo", "settings.tab.seo"],
          ["maintenance", "settings.tab.maintenance"]
        ] as Array<[SettingsPanel, string]>).map(([panel, labelKey]) => (
          <button
            aria-current={activePanel === panel ? "page" : undefined}
            className="liax-button"
            data-active={activePanel === panel}
            key={panel}
            onClick={() => setActivePanel(panel)}
            type="button"
          >
            {t(labelKey)}
          </button>
        ))}
      </nav>

      <section className="admin-settings-grid admin-single-column">
        <article className="liax-card admin-settings-panel" data-active={activePanel === "site"}>
          <div className="liax-card__header">
            <h3>{t("settings.home")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-home-settings-grid">
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.homeSignature")}</span>
                <input
                  disabled={isSiteFormDisabled}
                  value={homeSettings.signature}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, signature: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeBrandInfo")}</span>
                <input
                  disabled={isSiteFormDisabled}
                  value={homeSettings.brandInfo}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, brandInfo: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeIcpNumber")}</span>
                <input
                  disabled={isSiteFormDisabled}
                  value={homeSettings.icpNumber}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, icpNumber: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeIcpUrl")}</span>
                <input
                  disabled={isSiteFormDisabled}
                  type="url"
                  value={homeSettings.icpUrl}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, icpUrl: event.target.value }))}
                />
              </label>
              <div className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.siteLogoImage")}</span>
                <div className="admin-site-logo-upload">
                  <div className="admin-site-logo-upload__preview" aria-label={t("settings.siteLogoPreview")} data-status={logoPreviewImage.status}>
                    {logoPreviewImage.url ? <img alt={homeSettings.logoAlt || "Liax Space"} onError={() => {
                      logoPreviewImage.markFailed();
                    }} src={logoPreviewImage.url} /> : <span>LS</span>}
                  </div>
                  <div className="admin-site-logo-upload__actions">
                    <p className="admin-muted-text">{homeSettings.logoUrl ? t("settings.siteLogoConfigured") : t("settings.siteLogoEmpty")}</p>
                    <div className="admin-form-actions">
                      <label className="liax-button liax-button--primary admin-avatar-file-label">
                        <input
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="admin-avatar-file-input"
                          disabled={isSiteFormDisabled}
                          onChange={(event) => void handleLogoFileChange(event)}
                          type="file"
                        />
                        <span>{isUploadingLogo ? t("settings.siteLogoUploading") : t("settings.siteLogoUpload")}</span>
                      </label>
                      <button
                        className="liax-button"
                        disabled={isSiteFormDisabled || !homeSettings.logoUrl}
                        onClick={() => setHomeSettings((current) => ({ ...current, logoUrl: "" }))}
                        type="button"
                      >
                        {t("settings.siteLogoClear")}
                      </button>
                    </div>
                    <small>{t("settings.siteLogoUrlHelp")}</small>
                  </div>
                </div>
              </div>
              <label className="admin-form-field">
                <span>{t("settings.siteLogoAlt")}</span>
                <input
                  disabled={isSiteFormDisabled}
                  value={homeSettings.logoAlt}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, logoAlt: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeContactItemsZh")}</span>
                <textarea
                  disabled={isSiteFormDisabled}
                  rows={4}
                  value={homeSettings.contactItemsZh}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, contactItemsZh: event.target.value }))}
                />
                <small>{t("settings.homeContactItemsZhHelp")}</small>
              </label>
              <label className="admin-form-field">
                <span>{t("settings.homeContactItemsEn")}</span>
                <textarea
                  disabled={isSiteFormDisabled}
                  rows={4}
                  value={homeSettings.contactItemsEn}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, contactItemsEn: event.target.value }))}
                />
                <small>{t("settings.homeContactItemsEnHelp")}</small>
              </label>

            </div>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isSiteFormDisabled} onClick={() => void handleSaveHomeSettings()} type="button">
                {isSavingSite ? t("settings.saving") : t("settings.save")}
              </button>
            </div>
          </div>
        </article>

        <article className="liax-card admin-settings-panel" data-active={activePanel === "code"}>
          <div className="liax-card__header">
            <h3>{t("settings.codeInjection")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-home-settings-grid">
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.codeInjectionGlobalHead")}</span>
                <textarea
                  disabled={isSiteFormDisabled}
                  rows={5}
                  spellCheck={false}
                  value={homeSettings.injectionGlobalHead}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, injectionGlobalHead: event.target.value }))}
                />
                <small>{t("settings.codeInjectionGlobalHeadHelp")}</small>
              </label>
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.codeInjectionContentHead")}</span>
                <textarea
                  disabled={isSiteFormDisabled}
                  rows={5}
                  spellCheck={false}
                  value={homeSettings.injectionContentHead}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, injectionContentHead: event.target.value }))}
                />
                <small>{t("settings.codeInjectionContentHeadHelp")}</small>
              </label>
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.codeInjectionFooter")}</span>
                <textarea
                  disabled={isSiteFormDisabled}
                  rows={5}
                  spellCheck={false}
                  value={homeSettings.injectionFooter}
                  onChange={(event) => setHomeSettings((current) => ({ ...current, injectionFooter: event.target.value }))}
                />
                <small>{t("settings.codeInjectionFooterHelp")}</small>
              </label>
            </div>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isSiteFormDisabled} onClick={() => void handleSaveHomeSettings("settings.codeInjectionSaved")} type="button">
                {isSavingSite ? t("settings.saving") : t("settings.codeInjectionSave")}
              </button>
            </div>
          </div>
        </article>

        <article className="liax-card admin-settings-panel" data-active={activePanel === "ai"}>
          <div className="liax-card__header">
            <h3>{t("settings.ai")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-home-settings-grid">
              <label className="admin-form-field">
                <span>{t("settings.aiProvider")}</span>
                <select
                  disabled={isAiFormDisabled}
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
                  disabled={isAiFormDisabled}
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
                  disabled={isAiFormDisabled}
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
                  disabled={isAiFormDisabled}
                  type="url"
                  value={aiSettings.baseUrl}
                  onChange={(event) => setAiSettings((current) => ({ ...current, baseUrl: event.target.value }))}
                />
              </label>
              <label className="admin-form-field admin-home-settings-grid__wide">
                <span>{t("settings.aiModel")}</span>
                <input
                  disabled={isAiFormDisabled}
                  value={aiSettings.model}
                  onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))}
                />
                <small>{t("settings.aiModelHelp")}</small>
              </label>
            </div>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isAiFormDisabled} onClick={() => void handleSaveAiSettings()} type="button">
                {isSavingAi ? t("settings.saving") : t("settings.aiSave")}
              </button>
            </div>
          </div>
        </article>

        <article className="liax-card admin-settings-panel" data-active={activePanel === "mail"}>
          <div className="liax-card__header">
            <h3>{t("settings.smtp")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-home-settings-grid">
              <label className="admin-form-field">
                <span>{t("settings.smtpHost")}</span>
                <input
                  disabled={isSmtpFormDisabled}
                  value={smtpSettings.host}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, host: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpPort")}</span>
                <input
                  disabled={isSmtpFormDisabled}
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
                  disabled={isSmtpFormDisabled}
                  value={smtpSettings.user}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, user: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpPass")}</span>
                <input
                  autoComplete="new-password"
                  disabled={isSmtpFormDisabled}
                  type="password"
                  value={smtpSettings.pass}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, pass: event.target.value }))}
                />
                {smtpSettings.passConfigured ? <small>{t("settings.smtpPassConfiguredHelp")}</small> : null}
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpFrom")}</span>
                <input
                  disabled={isSmtpFormDisabled}
                  type="email"
                  value={smtpSettings.from}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, from: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpFromName")}</span>
                <input
                  disabled={isSmtpFormDisabled}
                  value={smtpSettings.fromName}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, fromName: event.target.value }))}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("settings.smtpEncryption")}</span>
                <select
                  disabled={isSmtpFormDisabled}
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
                  disabled={isSmtpFormDisabled}
                  onChange={(event) => setSmtpSettings((current) => ({ ...current, notificationsEnabled: event.target.checked }))}
                  type="checkbox"
                />
                <span>{t("settings.smtpNotificationsEnabled")}</span>
              </label>
            </div>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isSmtpFormDisabled} onClick={() => void handleSaveSmtpSettings()} type="button">
                {isSavingSmtp ? t("settings.saving") : t("settings.smtpSave")}
              </button>
            </div>
            <div className="admin-mail-settings">
              <section className="admin-mail-templates">
                <h4>{t("settings.mailTemplates")}</h4>
                {mailTemplates.length === 0 ? (
                  <p className="admin-muted-text">{t("settings.mailTemplatesEmpty")}</p>
                ) : mailTemplates.map((template) => {
                  const templateId = `${template.key}:${template.locale}`;

                  return (
                    <article className="admin-mail-template" key={templateId}>
                      <label className="admin-toggle-row">
                        <input
                          checked={template.enabled}
                          disabled={isLoading || savingMailTemplateId === templateId}
                          onChange={(event) => updateMailTemplate(template.id, { enabled: event.target.checked })}
                          type="checkbox"
                        />
                        <span>{t("settings.mailTemplateEnabled")} · {template.locale}</span>
                      </label>
                      <label className="admin-form-field">
                        <span>{t("settings.mailTemplateSubject")}</span>
                        <input
                          disabled={isLoading || savingMailTemplateId === templateId}
                          value={template.subject}
                          onChange={(event) => updateMailTemplate(template.id, { subject: event.target.value })}
                        />
                      </label>
                      <label className="admin-form-field">
                        <span>{t("settings.mailTemplateBody")}</span>
                        <textarea
                          disabled={isLoading || savingMailTemplateId === templateId}
                          rows={7}
                          value={template.bodyText}
                          onChange={(event) => updateMailTemplate(template.id, { bodyText: event.target.value })}
                        />
                      </label>
                      <div className="admin-form-actions">
                        <button
                          className="liax-button"
                          disabled={isLoading || savingMailTemplateId === templateId}
                          onClick={() => void handleSaveMailTemplate(template)}
                          type="button"
                        >
                          {savingMailTemplateId === templateId ? t("settings.saving") : t("settings.mailTemplateSave")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
              <section className="admin-mail-log">
                <h4>{t("settings.mailLogs")}</h4>
                {mailLogs.length === 0 ? (
                  <p className="admin-muted-text">{t("settings.mailLogsEmpty")}</p>
                ) : mailLogs.map((log) => (
                  <article className="admin-mail-log__item" data-status={log.status} key={log.id}>
                    <div>
                      <strong>{t(`settings.mailStatus.${log.status}`)} · {log.subject}</strong>
                      <small>{new Date(log.createdAt).toLocaleString()} · {log.recipient || t("settings.mailNoRecipient")}</small>
                    </div>
                    <p>{log.message || log.providerResponse || "-"}</p>
                  </article>
                ))}
              </section>
            </div>
          </div>
        </article>

        <article className="liax-card admin-settings-panel" data-active={activePanel === "seo"}>
          <div className="liax-card__header">
            <h3>{t("settings.seoPush")}</h3>
          </div>
          <div className="liax-card__body">
            <div className="admin-seo-push-grid">
              {(Object.keys(seoPushSettings) as SeoPushProvider[]).map((provider) => (
                <section className="admin-seo-push-provider" key={provider}>
                  <label className="admin-toggle-row">
                    <input
                      checked={seoPushSettings[provider].enabled}
                      disabled={isSeoPushFormDisabled}
                      onChange={(event) => updateSeoPushProvider(provider, { enabled: event.target.checked })}
                      type="checkbox"
                    />
                    <span>{formatSeoPushProvider(provider)}</span>
                  </label>
                  <label className="admin-form-field">
                    <span>{t("settings.seoPushSite")}</span>
                    <input
                      disabled={isSeoPushFormDisabled}
                      value={seoPushSettings[provider].site}
                      onChange={(event) => updateSeoPushProvider(provider, { site: event.target.value })}
                    />
                  </label>
                  <label className="admin-form-field">
                    <span>{t(provider === "google" ? "settings.seoPushAccessToken" : "settings.seoPushKey")}</span>
                    <input
                      autoComplete="off"
                      disabled={isSeoPushFormDisabled}
                      type="password"
                      value={seoPushSettings[provider].key}
                      onChange={(event) => updateSeoPushProvider(provider, { key: event.target.value })}
                    />
                  </label>
                  <label className="admin-form-field">
                    <span>{t("settings.seoPushEndpoint")}</span>
                    <input
                      disabled={isSeoPushFormDisabled}
                      value={seoPushSettings[provider].url}
                      onChange={(event) => updateSeoPushProvider(provider, { url: event.target.value })}
                    />
                  </label>
                </section>
              ))}
            </div>
            <div className="admin-form-actions">
              <button className="liax-button liax-button--primary" disabled={isSeoPushFormDisabled} onClick={() => void handleSaveSeoPushSettings()} type="button">
                {isSavingSeoPush ? t("settings.saving") : t("settings.seoPushSave")}
              </button>
              <button className="liax-button" disabled={isSeoPushFormDisabled} onClick={() => void handleSubmitSeoPush()} type="button">
                {isSubmittingSeoPush ? t("settings.seoPushSubmitting") : t("settings.seoPushSubmit")}
              </button>
            </div>
            <div className="admin-seo-push-log">
              <h4>{t("settings.seoPushLogs")}</h4>
              {seoPushSubmissions.length === 0 ? (
                <p className="admin-muted-text">{t("settings.seoPushLogsEmpty")}</p>
              ) : seoPushSubmissions.map((submission) => (
                <article className="admin-seo-push-log__item" data-status={submission.status} key={submission.id}>
                  <div>
                    <strong>{formatSeoPushProvider(submission.provider)} · {t(`settings.seoPushStatus.${submission.status}`)}</strong>
                    <small>{new Date(submission.createdAt).toLocaleString()} · {submission.submittedCount} URL</small>
                  </div>
                  <p>{submission.message || submission.requestUrl || "-"}</p>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="liax-card admin-settings-panel" data-active={activePanel === "maintenance"}>
          <div className="liax-card__header">
            <h3>{t("settings.maintenance")}</h3>
          </div>
          <div className="liax-card__body">
            <section className="admin-maintenance-block">
              <div>
                <h4>{t("settings.preflightTitle")}</h4>
                <p className="admin-muted-text">{t("settings.preflightHelp")}</p>
              </div>
              <div className="admin-form-actions">
                <button className="liax-button liax-button--primary" disabled={isMaintenanceDisabled} onClick={() => void handleRunPreflight()} type="button">
                  {isRunningPreflight ? t("settings.preflightRunning") : t("settings.preflightRun")}
                </button>
              </div>
              <div className="admin-preflight-summary" aria-label={t("settings.preflightSummary")}>
                {(["fail", "warning", "pass"] as PreflightCheckStatus[]).map((status) => (
                  <span className="admin-status-badge" data-status={status} key={status}>
                    {t(`settings.preflightStatus.${status}`)} · {preflightSummary[status] ?? 0}
                  </span>
                ))}
              </div>
              <div className="admin-preflight-list">
                {preflightChecks.map((check) => (
                  <article className="admin-preflight-check" data-status={check.status} key={check.key}>
                    <div>
                      <strong>{t(`settings.preflight.${check.key}.title`)}</strong>
                      <span className="admin-status-badge" data-status={check.status}>{t(`settings.preflightStatus.${check.status}`)}</span>
                    </div>
                    <p>{t(`settings.preflight.${check.key}.${check.status}`)}</p>
                    {check.count > 0 ? <small>{t("settings.preflightCount").replace("{count}", String(check.count))}</small> : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-maintenance-block">
              <div>
                <h4>{t("settings.testDataTitle")}</h4>
                <p className="admin-muted-text">{t("settings.testDataHelp")}</p>
              </div>
              <div className="admin-form-actions">
                <button className="liax-button" disabled={isMaintenanceDisabled} onClick={() => void refreshGuestbookTestData()} type="button">
                  {t("settings.testDataRefresh")}
                </button>
                <button className="liax-button liax-button--danger" disabled={isMaintenanceDisabled || testDataCount === 0} onClick={() => void handleCleanupGuestbookTestData()} type="button">
                  {isCleaningTestData ? t("settings.testDataCleaning") : t("settings.testDataCleanup")}
                </button>
              </div>
              <p className="admin-muted-text">{t("settings.testDataMatched").replace("{count}", String(testDataCount))}</p>
              {testDataEntries.length === 0 ? (
                <p className="admin-empty-card">{t("settings.testDataEmpty")}</p>
              ) : (
                <div className="admin-test-data-list">
                  {testDataEntries.map((entry) => (
                    <article className="admin-test-data-item" key={entry.id}>
                      <strong>#{entry.id} · {entry.authorName}</strong>
                      <small>{entry.locale} · {new Date(entry.createdAt).toLocaleString()}</small>
                      <p>{entry.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </article>
      </section>

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
    </AdminLayout>
  );
}
