"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALE_COOKIE, LOCALE_LABELS, LOCALES, localeHref, stripLocale, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/components/I18nProvider";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Not sensitive and read by the proxy on the server – a normal cookie is enough. */
function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** Switches language on the same page (keeping the period) and remembers the choice for "/". */
export function LanguageSwitcher() {
  const { t, locale } = useI18n();
  const path = stripLocale(usePathname());
  const query = useSearchParams().toString();
  return (
    <div className="px-3">
      <p className="mb-1.5 text-xs font-medium text-muted" id="language-label">
        {t("nav.language")}
      </p>
      <div role="group" aria-labelledby="language-label" className="inline-flex rounded-lg border border-border bg-bg p-0.5">
        {LOCALES.map((l) => (
          <Link
            key={l}
            href={`${localeHref(l, path)}${query ? `?${query}` : ""}`}
            hrefLang={l}
            lang={l}
            title={LOCALE_LABELS[l]}
            aria-current={l === locale ? "true" : undefined}
            onClick={() => rememberLocale(l)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase ${l === locale ? "bg-accent text-white" : "text-muted hover:text-text"}`}
          >
            {l}
          </Link>
        ))}
      </div>
    </div>
  );
}
