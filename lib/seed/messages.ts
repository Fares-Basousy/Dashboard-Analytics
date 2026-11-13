import type { Translator } from "@/lib/i18n/translate";
import type { SeedEvent } from "./shopify-seed";

/** Words a seed event for people – shared by the Settings toast and the CLI. */
export function describeSeedEvent(event: SeedEvent, { t }: Pick<Translator, "t">): { title: string; message: string } {
  switch (event.type) {
    case "status":
      return {
        title: t("seed.pending"),
        message: event.step === "checking" ? t("seed.checking") : t("seed.preparing", { count: event.products, shop: event.shop }),
      };
    case "progress": {
      const line = t("seed.line", { order: event.order, day: event.day, items: event.items });
      return {
        title: t("seed.progress", { done: event.done, total: event.total }),
        message: event.refunded ? t("seed.refunded", { line, count: event.refunded }) : line,
      };
    }
    case "done":
      return { title: t("seed.done"), message: t("seed.doneMessage", { shop: event.shop, orders: event.orders, refunds: event.refunds }) };
    case "error":
      // Technical reasons from Shopify stay in their original wording.
      return { title: t("seed.failed"), message: event.message };
  }
}
