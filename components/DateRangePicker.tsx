"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DEFAULT_PRESET, isPreset, PRESETS } from "@/lib/date-range";
import { RANGE_PARAM } from "@/lib/navigation";
import { useI18n } from "@/components/I18nProvider";

export function DateRangePicker() {
  const { t } = useI18n();
  const pathname = usePathname();
  const value = useSearchParams().get(RANGE_PARAM);
  const current = isPreset(value) ? value : DEFAULT_PRESET;

  return (
    <div role="group" aria-label={t("range.label")} className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((p) => (
        <Link
          key={p}
          href={`${pathname}?${RANGE_PARAM}=${p}`}
          aria-pressed={p === current}
          className={`rounded-md px-3 py-1 text-xs font-medium ${p === current ? "bg-accent text-white" : "text-muted hover:text-text"}`}
        >
          {t("range.last", { days: PRESETS[p] })}
        </Link>
      ))}
    </div>
  );
}
