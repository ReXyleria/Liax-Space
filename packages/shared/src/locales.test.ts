import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  localeToPrefix,
  prefixToLocale
} from "./locales.js";

describe("locales", () => {
  it("defines supported locales and default locale", () => {
    assert.deepEqual(SUPPORTED_LOCALES, ["zh-CN", "en-US"]);
    assert.equal(DEFAULT_LOCALE, "zh-CN");
  });

  it("maps locales to public URL prefixes", () => {
    assert.equal(localeToPrefix("zh-CN"), "zh");
    assert.equal(localeToPrefix("en-US"), "en");
  });

  it("maps public URL prefixes to locales", () => {
    assert.equal(prefixToLocale("zh"), "zh-CN");
    assert.equal(prefixToLocale("en"), "en-US");
  });

  it("checks supported locale values", () => {
    assert.equal(isSupportedLocale("zh-CN"), true);
    assert.equal(isSupportedLocale("en-US"), true);
    assert.equal(isSupportedLocale("zh"), false);
    assert.equal(isSupportedLocale("fr-FR"), false);
    assert.equal(isSupportedLocale(null), false);
  });
});

