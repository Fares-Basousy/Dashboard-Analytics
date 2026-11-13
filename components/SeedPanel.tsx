"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast, type ToastProps } from "@/components/ui/Toast";
import { refreshDashboardData } from "@/app/[lang]/(dashboard)/settings/actions";
import { useI18n } from "@/components/I18nProvider";
import { describeSeedEvent } from "@/lib/seed/messages";
import type { SeedEvent } from "@/lib/seed/shopify-seed";

const ORDER_CHOICES = [5, 10, 15] as const;
const SECONDS_PER_ORDER = 13;
const DONE_TOAST_MS = 10_000;

type ToastState = Omit<ToastProps, "onClose"> | null;

/** Read an NDJSON stream line by line. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<SeedEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as SeedEvent;
  }
}

/** "Generate test data" button: runs the Shopify dev-store seed and reports Pending → Seeding → Done. */
export function SeedPanel({ enabled }: { enabled: boolean }) {
  const i18n = useI18n();
  const { t } = i18n;
  const router = useRouter();
  const [orders, setOrders] = useState<number>(10);
  const [toast, setToast] = useState<ToastState>(null);
  const running = toast?.tone === "pending" || toast?.tone === "progress";

  // Auto-hide the success message; errors stay until dismissed.
  useEffect(() => {
    if (toast?.tone !== "success") return;
    const timer = setTimeout(() => setToast(null), DONE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  async function run() {
    setToast({ tone: "pending", title: t("seed.pending"), message: t("seed.starting") });
    const fail = (message: string) => setToast({ tone: "error", title: t("seed.failed"), message });
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders, days: 30 }),
      });
      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        return fail(error);
      }
      for await (const event of readEvents(res.body)) {
        const text = describeSeedEvent(event, i18n);
        if (event.type === "status") setToast({ tone: "pending", ...text });
        if (event.type === "progress") setToast({ tone: "progress", ...text, progress: event });
        if (event.type === "error") return fail(event.message);
        if (event.type === "done") {
          await refreshDashboardData();
          router.refresh();
          setToast({ tone: "success", ...text });
          return;
        }
      }
      fail(t("seed.connectionEnded"));
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("seed.description")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {t("seed.orders")}
          <select
            value={orders}
            onChange={(e) => setOrders(Number(e.target.value))}
            disabled={running}
            className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
          >
            {ORDER_CHOICES.map((n) => (
              <option key={n} value={n}>
                {t("seed.option", { count: n, minutes: Math.ceil((n * SECONDS_PER_ORDER) / 60) })}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={!enabled || running}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? t("seed.running") : t("seed.button")}
        </button>
        {!enabled && <span className="text-xs text-muted">{t("seed.connectFirst")}</span>}
      </div>
      {toast && <Toast {...toast} onClose={running ? undefined : () => setToast(null)} />}
    </div>
  );
}
