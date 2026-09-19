// Minimal i18n layer (PRD §3: English only in v1, but every UI string goes
// through here so Hindi / regional locales are a content change, not a code
// change). Test content itself lives in /content and is localised there.
import en from "../../locales/en.json";

type Key = keyof typeof en;
const dictionaries: Record<string, Record<string, string>> = { en };
let locale = "en";

export function setLocale(next: string) {
  if (dictionaries[next]) locale = next;
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  const raw = dictionaries[locale]?.[key] ?? en[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : raw;
}
