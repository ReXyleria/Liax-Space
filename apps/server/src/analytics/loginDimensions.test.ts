import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDetailedOperatingSystem, readLoginCountry } from "./loginDimensions.js";

describe("loginDimensions", () => {
  it("reads login country from trusted edge headers and browser language regions", () => {
    assert.equal(readLoginCountry({ "cf-ipcountry": "US" }), "US");
    assert.equal(readLoginCountry({ "x-vercel-ip-country": "JP" }), "JP");
    assert.equal(readLoginCountry({ "cf-ipcountry": "DE", "accept-language": "en-US,en;q=0.9" }), "DE");
    assert.equal(readLoginCountry({ "accept-language": "en-US,en;q=0.9" }), "US");
    assert.equal(readLoginCountry({ "accept-language": "zh-Hant-TW,zh;q=0.8" }), "TW");
    assert.equal(readLoginCountry({ "accept-language": "fr,en;q=0.8" }), "Unknown");
    assert.equal(readLoginCountry({}), "Unknown");
  });

  it("classifies login operating systems with concrete version labels", () => {
    assert.equal(
      readDetailedOperatingSystem("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
      "Windows 10/11 (NT 10.0)"
    );
    assert.equal(
      readDetailedOperatingSystem("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15"),
      "iOS 17.5"
    );
    assert.equal(
      readDetailedOperatingSystem("Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36"),
      "Android 14"
    );
    assert.equal(
      readDetailedOperatingSystem("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15"),
      "macOS 14.5"
    );
  });
});
