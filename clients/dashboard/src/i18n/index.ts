import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { tr } from "./locales/tr";

export const LANGUAGES = ["tr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "tr";
const LANGUAGE_STORAGE_KEY = "fsh.dashboard.lang";

/** BCP-47 locale per UI language — drives every Intl formatter. */
const LOCALES: Record<Language, string> = { tr: "tr-TR", en: "en-US" };

export const resources = { tr, en } as const;

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

const initial = readStoredLanguage();
document.documentElement.lang = initial;

// Resources are bundled (both catalogs are small), so init is synchronous
// and the first render already has strings — no Suspense needed.
void i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: "common",
  ns: Object.keys(tr),
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* storage unavailable */
  }
});

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

export function currentLocale(): string {
  return LOCALES[currentLanguage()];
}

export function setLanguage(lng: Language): void {
  void i18n.changeLanguage(lng);
}

export { i18n };
