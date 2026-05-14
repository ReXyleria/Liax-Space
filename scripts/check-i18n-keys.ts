import { messages, type Locale } from "../src/lib/i18n-messages";

const locales = Object.keys(messages) as Locale[];
const [baseLocale] = locales;
const baseKeys = Object.keys(messages[baseLocale]).sort();
let failed = false;

for (const locale of locales) {
  const keys = Object.keys(messages[locale]).sort();
  const missing = baseKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !baseKeys.includes(key));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`[i18n] ${locale} key mismatch`);
    if (missing.length) {
      console.error(`  missing: ${missing.join(", ")}`);
    }
    if (extra.length) {
      console.error(`  extra: ${extra.join(", ")}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`[i18n] ${locales.join(", ")} dictionaries have ${baseKeys.length} matching keys.`);
