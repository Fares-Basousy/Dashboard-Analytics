import type { MessageKey } from "@/lib/i18n/messages/en";

/** Paths are without the language prefix; links add it (see localeHref). */
export const NAV_ITEMS: { href: string; labelKey: MessageKey; icon: string }[] = [
  { href: "/", labelKey: "nav.overview", icon: "◧" },
  { href: "/products", labelKey: "nav.products", icon: "▤" },
  { href: "/marketing", labelKey: "nav.marketing", icon: "◎" },
  { href: "/insights", labelKey: "nav.insights", icon: "✦" },
  { href: "/settings", labelKey: "nav.settings", icon: "⚙" },
];

/** Query param holding the selected period, shared by every page and the chat. */
export const RANGE_PARAM = "range";
