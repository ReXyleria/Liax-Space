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

  it("does not return saved SMTP passwords in site settings responses", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    const updated = await service.updateSiteSettings({
      "smtp.encryption": "starttls",
      "smtp.from": "site@example.test",
      "smtp.host": "smtp.example.test",
      "smtp.notificationsEnabled": true,
      "smtp.pass": "smtp-secret",
      "smtp.port": "587",
      "smtp.user": "site@example.test"
    });
    const loaded = await service.getSiteSettings();

    assert.equal(repository.settings["smtp.pass"], "smtp-secret");
    assert.equal(repository.settings["smtp.port"], 587);
    assert.equal(updated["smtp.pass"], undefined);
    assert.equal(loaded["smtp.pass"], undefined);
    assert.equal(updated["smtp.passConfigured"], true);
    assert.equal(loaded["smtp.passConfigured"], true);
  });

  it("keeps an existing SMTP password when a settings patch sends an empty password", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await service.updateSiteSettings({
      "smtp.pass": "smtp-secret"
    });
    const updated = await service.updateSiteSettings({
      "smtp.host": "smtp.example.test",
      "smtp.pass": ""
    });

    assert.equal(repository.settings["smtp.pass"], "smtp-secret");
    assert.equal(repository.settings["smtp.host"], "smtp.example.test");
    assert.equal(updated["smtp.pass"], undefined);
    assert.equal(updated["smtp.passConfigured"], true);
  });

  it("normalizes known site settings before saving them", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await service.updateSiteSettings({
      "ai.baseUrl": "https://api.deepseek.com/",
      "ai.chunkConcurrency": "3",
      "ai.model": " deepseek-chat ",
      "ai.provider": "deepseek",
      "ai.taskConcurrency": "2",
      "ai.translationTemperature": "0.7",
      "home.brandInfo": "当前版本先提供稳定跳转",
      "home.signature": "作者 · Liax",
      "home.contactItems.en-US": " Email:hello@example.com ",
      "home.contactItems.zh-CN": " 邮箱:hello@example.com ",
      "home.icpNumber": "备案号待配置",
      "home.icpUrl": "https://beian.miit.gov.cn/",
      "smtp.encryption": "ssl_tls",
      "smtp.from": " site@example.test ",
      "smtp.fromName": " Site Mail ",
      "smtp.host": " smtp.example.test ",
      "smtp.notificationsEnabled": false,
      "smtp.port": "465",
      "smtp.user": " user@example.test ",
      "theme.customColors": {
        "quiet-garden": {
          "--color-accent": "#ABCDEF"
        }
      },
      "theme.preset": "quiet-garden"
    });

    assert.equal(repository.settings["ai.baseUrl"], "https://api.deepseek.com");
    assert.equal(repository.settings["ai.chunkConcurrency"], 3);
    assert.equal(repository.settings["ai.model"], "deepseek-chat");
    assert.equal(repository.settings["ai.taskConcurrency"], 2);
    assert.equal(repository.settings["ai.translationTemperature"], 0.7);
    assert.equal(repository.settings["home.brandInfo"], "");
    assert.equal(repository.settings["home.signature"], "");
    assert.equal(repository.settings["home.contactItems.en-US"], "");
    assert.equal(repository.settings["home.contactItems.zh-CN"], "");
    assert.equal(repository.settings["home.icpNumber"], "");
    assert.equal(repository.settings["home.icpUrl"], "https://beian.miit.gov.cn");
    assert.equal(repository.settings["smtp.encryption"], "ssl_tls");
    assert.equal(repository.settings["smtp.from"], "site@example.test");
    assert.equal(repository.settings["smtp.fromName"], "Site Mail");
    assert.equal(repository.settings["smtp.host"], "smtp.example.test");
    assert.equal(repository.settings["smtp.notificationsEnabled"], false);
    assert.equal(repository.settings["smtp.port"], 465);
    assert.equal(repository.settings["smtp.user"], "user@example.test");
    assert.deepEqual(repository.settings["theme.customColors"], {
      "quiet-garden": {
        "--color-accent": "#abcdef"
      }
    });
  });

  it("does not expose saved placeholder copy to the admin settings form", async () => {
    const repository = new MemorySettingsRepository();
    repository.settings = {
      "home.brandInfo": "当前版本先提供稳定跳转",
      "home.signature": "Author · Liax",
      "home.contactItems.en-US": "Email: hello@example.com",
      "home.contactItems.zh-CN": "QQ 123456",
      "home.icpNumber": "备案号待配置"
    };
    const service = new SiteSettingsService(repository as never);

    const loaded = await service.getSiteSettings();

    assert.equal(loaded["home.brandInfo"], "");
    assert.equal(loaded["home.signature"], "");
    assert.equal(loaded["home.contactItems.en-US"], "");
    assert.equal(loaded["home.contactItems.zh-CN"], "");
    assert.equal(loaded["home.icpNumber"], "");
  });

  it("returns only safe appearance settings for non-maintenance readers", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await service.updateSiteSettings({
      "ai.apiKey": "provider-secret-key",
      "site.logoAlt": "Liax Space",
      "site.logoUrl": "https://example.com/logo.png",
      "smtp.pass": "smtp-secret",
      "theme.customColors": {
        "quiet-garden": {
          "--color-accent": "#abcdef"
        }
      },
      "theme.preset": "quiet-garden"
    });

    assert.deepEqual(await service.getAppearanceSettings(), {
      "site.logoAlt": "Liax Space",
      "site.logoUrl": "https://example.com/logo.png",
      "theme.customColors": {
        "quiet-garden": {
          "--color-accent": "#abcdef"
        }
      },
      "theme.preset": "quiet-garden"
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

  it("rejects invalid AI chunk concurrency settings", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await assert.rejects(
      () => service.updateSiteSettings({ "ai.chunkConcurrency": 0 }),
      /ai\.chunkConcurrency must be an integer from 1 to 16/u
    );
  });

  it("rejects invalid AI task concurrency settings", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await assert.rejects(
      () => service.updateSiteSettings({ "ai.taskConcurrency": 9 }),
      /ai\.taskConcurrency must be an integer from 1 to 8/u
    );
  });

  it("rejects invalid SMTP settings", async () => {
    const repository = new MemorySettingsRepository();
    const service = new SiteSettingsService(repository as never);

    await assert.rejects(
      () => service.updateSiteSettings({ "smtp.encryption": "tls" }),
      /smtp\.encryption must be one of/u
    );

    await assert.rejects(
      () => service.updateSiteSettings({ "smtp.port": 70000 }),
      /smtp\.port must be an integer from 1 to 65535/u
    );

    await assert.rejects(
      () => service.updateSiteSettings({ "smtp.from": "bad-address" }),
      /smtp\.from must be a valid email address/u
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
