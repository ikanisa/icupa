import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { i18next } from "./config";

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider = ({ children }: I18nProviderProps) => {
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
};
