import IntlMessageFormat from "intl-messageformat";
import { dictionaries } from "./translations";

export type Locale = keyof typeof dictionaries;

export function createTranslator(locale: Locale) {
  const messages = dictionaries[locale] ?? dictionaries.en;

  return function translate(key: string, values?: Record<string, unknown>) {
    const template = messages[key as keyof typeof messages];
    if (!template) {
      console.warn(`Missing translation for key ${key} in locale ${locale}`);
      return key;
    }

    if (!values || Object.keys(values).length === 0) {
      return template as string;
    }

    return new IntlMessageFormat(template as string, locale).format(values) as string;
  };
}

export const availableLocales = Object.keys(dictionaries) as Locale[];
