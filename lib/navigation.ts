export const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: "◧" },
  { href: "/products", label: "Products", icon: "▤" },
  { href: "/marketing", label: "Marketing", icon: "◎" },
  { href: "/insights", label: "AI Insights", icon: "✦" },
  { href: "/settings", label: "Connections & Keys", icon: "⚙" },
] as const;

/** Query param holding the selected period, shared by every page and the chat. */
export const RANGE_PARAM = "range";
