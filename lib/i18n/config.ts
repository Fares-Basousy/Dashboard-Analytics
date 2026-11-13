/** Supported languages. Client-safe. */
export const LOCALES = ["en", "sv", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Shown in the language switcher (each in its own language). */
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", sv: "Svenska", de: "Deutsch" };

/** Used in AI prompts ("answer in …"). */
export const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", sv: "Swedish", de: "German" };

/** Remembers the visitor's choice for links without a language (e.g. "/"). Not sensitive. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** "/products" → "/de/products". */
export const localeHref = (locale: Locale, path: string) => `/${locale}${path === "/" ? "" : path}`;

/** "/de/products?range=7d" → "/products?range=7d". */
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  return isLocale(first) ? `/${rest.join("/")}` : pathname;
}

/**
 * Pick the language for a request without one in the URL:
 * the saved choice, else the best match from the browser's Accept-Language header, else English.
 */
export function preferredLocale(cookieValue: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { lang: tag.split("-")[0], q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.find((x) => isLocale(x.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}
