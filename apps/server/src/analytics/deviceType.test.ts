import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeDeviceType, readDeviceType } from "./deviceType.js";

describe("deviceType", () => {
  it("classifies public visit user agents by concrete device family", () => {
    assert.equal(readDeviceType("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36"), "android");
    assert.equal(readDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"), "ios");
    assert.equal(readDeviceType("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"), "ipados");
    assert.equal(readDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"), "windows");
    assert.equal(readDeviceType("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15"), "macos");
    assert.equal(readDeviceType("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), "bot");
  });

  it("normalizes stored device buckets without exposing arbitrary labels", () => {
    assert.equal(normalizeDeviceType("Android"), "android");
    assert.equal(normalizeDeviceType("desktop"), "desktop");
    assert.equal(normalizeDeviceType("unexpected-device"), "unknown");
    assert.equal(normalizeDeviceType(null), "unknown");
  });
});
