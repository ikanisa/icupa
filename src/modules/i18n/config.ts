import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./resources/en/common.json";
import frCommon from "./resources/fr/common.json";

export const defaultNS = "common";

const resources = {
  en: { common: enCommon },
  fr: { common: frCommon },
};

if (!i18next.isInitialized) {
  void i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: "en",
      defaultNS,
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ["querystring", "localStorage", "navigator"],
        caches: ["localStorage"],
      },
    });
}

export { i18next };
