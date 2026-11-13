"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { localeHref, type Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import type { Messages } from "@/lib/i18n/messages/en";

const I18nContext = createContext<(Translator & { href: (path: string) => string }) | null>(null);

/** Gives client components the (already resolved) texts of the current language. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ ...createTranslator(locale, messages), href: (path: string) => localeHref(locale, path) }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
