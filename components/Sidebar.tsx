"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS, RANGE_PARAM } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const range = useSearchParams().get(RANGE_PARAM);
  const withRange = (href: string) => (range ? `${href}?${RANGE_PARAM}=${range}` : href);

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Main">
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
