import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { readStoredLocale, writeStoredLocale } from "../i18n/localeStorage.js";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function createMemoryStorage(initialValues: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}

function installBrowserGlobals(localStorage: MemoryStorage, cookie = ""): void {
  let currentCookie = cookie;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage
    }
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return currentCookie;
      },
      set cookie(value: string) {
        currentCookie = value;
      }
    }
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument
  });
});

describe("localeStorage", () => {
  it("writes admin, public, and cookie locale preferences together", () => {
    const localStorage = createMemoryStorage();
    installBrowserGlobals(localStorage);

    writeStoredLocale("en-US");

    assert.equal(localStorage.getItem("liax.admin.locale"), "en-US");
    assert.equal(localStorage.getItem("liax.public.locale"), "en-US");
    assert.match(document.cookie, /liax\.locale=en-US/u);
  });

  it("can read the public locale key when the admin key is missing", () => {
    const localStorage = createMemoryStorage({
      "liax.public.locale": "en-US"
    });
    installBrowserGlobals(localStorage);

    assert.equal(readStoredLocale(), "en-US");
  });

  it("uses the shared cookie before local storage so public navigation can steer the console", () => {
    const localStorage = createMemoryStorage({
      "liax.admin.locale": "zh-CN"
    });
    installBrowserGlobals(localStorage, "liax.locale=en-US");

    assert.equal(readStoredLocale(), "en-US");
  });
});
