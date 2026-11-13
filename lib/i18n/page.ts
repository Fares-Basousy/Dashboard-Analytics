import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import { getTranslator } from "./server";

/** The language of the current page, from the /[lang] URL segment (Server Components only). */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!isLocale(value)) notFound();
  return value;
}

/** Translator for the current page – no prop drilling needed. */
export async function getI18n() {
  return getTranslator(await getLocale());
}
