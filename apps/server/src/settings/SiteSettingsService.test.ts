import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SiteSettingsService } from "./SiteSettingsService.js";
import type { SiteSettings } from "./settings.types.js";

class MemorySettingsRepository {
  settings: SiteSettings = {};

  async getSiteSettings(): Promise<SiteSettings> {
    return { ...this.settings };
  }

  async updateSiteSettings(input: SiteSettings): Promise<SiteSettings> {
    this.settings = {
      ...this.settings,
      ...input
    };

    return { ...this.settings };
  }
}

describe("SiteSettingsService", () => {
  it("does not return saved AI API keys in site settings responses", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    const updated = await service.updateSiteSettings({
      "ai.apiKey": "provider-secret-key",
      "ai.baseUrl": "https://api.deepseek.com",
      "ai.model": "deepseek-chat",
      "ai.provider": "deepseek"
    });
    const loaded = await service.getSiteSettings();

    assert.equal(repository.settings["ai.apiKey"], "provider-secret-key");
    assert.equal(updated["ai.apiKey"], undefined);
    assert.equal(loaded["ai.apiKey"], undefined);
    assert.equal(updated["ai.apiKeyConfigured"], true);
    assert.equal(loaded["ai.apiKeyConfigured"], true);
  });

  it("keeps an existing AI API key when a settings patch sends an empty key", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await service.updateSiteSettings({
      "ai.apiKey": "provider-secret-key"
    });
    const updated = await service.updateSiteSettings({
      "ai.apiKey": "",
      "ai.model": "deepseek-chat"
    });

    assert.equal(repository.settings["ai.apiKey"], "provider-secret-key");
    assert.equal(updated["ai.apiKey"], undefined);
    assert.equal(updated["ai.apiKeyConfigured"], true);
    assert.equal(updated["ai.model"], "deepseek-chat");
  });

  it("normalizes known site settings before saving them", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await service.updateSiteSettings({
      "ai.baseUrl": "https://api.deepseek.com/",
      "ai.model": " deepseek-chat ",
      "ai.provider": "deepseek",
      "ai.translationTemperature": "0.7",
      "home.contactItems.en-US": " Email:hello@example.com ",
      "home.contactItems.zh-CN": " 邮箱:hello@example.com ",
      "home.icpUrl": "https://beian.miit.gov.cn/",
      "theme.customColors": {
        "quiet-garden": {
          "--color-accent": "#ABCDEF"
        }
      },
      "theme.preset": "quiet-garden"
    });

    assert.equal(repository.settings["ai.baseUrl"], "https://api.deepseek.com");
    assert.equal(repository.settings["ai.model"], "deepseek-chat");
    assert.equal(repository.settings["ai.translationTemperature"], 0.7);
    assert.equal(repository.settings["home.contactItems.en-US"], "Email:hello@example.com");
    assert.equal(repository.settings["home.contactItems.zh-CN"], "邮箱:hello@example.com");
    assert.equal(repository.settings["home.icpUrl"], "https://beian.miit.gov.cn");
    assert.deepEqual(repository.settings["theme.customColors"], {
      "quiet-garden": {
        "--color-accent": "#abcdef"
      }
    });
  });

  it("keeps unknown site settings JSON-compatible for future expansion", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await service.updateSiteSettings({
      "future.setting": {
        enabled: true
      }
    });

    assert.deepEqual(repository.settings["future.setting"], {
      enabled: true
    });
  });

  it("rejects invalid AI provider settings", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await assert.rejects(
      () => service.updateSiteSettings({ "ai.provider": "bad-provider" }),
      /ai\.provider must be one of/u
    );
  });

  it("rejects invalid AI temperature settings", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await assert.rejects(
      () => service.updateSiteSettings({ "ai.translationTemperature": 2.5 }),
      /ai\.translationTemperature must be a number from 0 to 2/u
    );
  });

  it("rejects invalid setting URLs", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await assert.rejects(
      () => service.updateSiteSettings({ "ai.baseUrl": "javascript:alert(1)" }),
      /ai\.baseUrl must use http or https/u
    );
  });

  it("rejects writes to derived AI API key status", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await assert.rejects(
      () => service.updateSiteSettings({ "ai.apiKeyConfigured": true }),
      /ai\.apiKeyConfigured is read-only/u
    );
  });

  it("rejects invalid custom theme color payloads", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await assert.rejects(
      () => service.updateSiteSettings({
        "theme.customColors": {
          "quiet-garden": {
            "--color-primary": "blue"
          }
        }
      }),
      /theme\.customColors\.quiet-garden\.--color-primary must be a 6 digit hex color/u
    );

    await assert.rejects(
      () => service.updateSiteSettings({
        "theme.customColors": {
          "unknown-theme": {
            "--color-primary": "#111315"
          }
        }
      }),
      /theme\.customColors contains an unknown preset/u
    );
  });
});
