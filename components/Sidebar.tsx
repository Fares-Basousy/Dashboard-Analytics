"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS, RANGE_PARAM } from "@/lib/navigation";
import { stripLocale } from "@/lib/i18n/config";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function Sidebar() {
  const { t, href } = useI18n();
  const pathname = stripLocale(usePathname());
  const range = useSearchParams().get(RANGE_PARAM);
  const withRange = (path: string) => (range ? `${href(path)}?${RANGE_PARAM}=${range}` : href(path));

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label={t("nav.main")}>
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={withRange(item.href)}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              <span aria-hidden className="w-4 text-center">{item.icon}</span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <LanguageSwitcher />
    </div>
  );
}
