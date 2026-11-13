import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ChatPanel } from "@/components/ChatPanel";
import { getI18n } from "@/lib/i18n/page";

/** App shell: navigation, period picker and the AI assistant around every dashboard page. */
export default async function DashboardLayout({ children }: LayoutProps<"/[lang]">) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-4 py-4 md:sticky md:top-0">
          <div className="mb-4 px-3 md:mb-8">
            <p className="text-base font-semibold">✦ Profit Pilot</p>
            <p className="text-xs text-muted">{t("brand.tagline")}</p>
          </div>
          {/* Client components reading the URL need a Suspense boundary under Cache Components. */}
          <Suspense>
            <Sidebar />
          </Suspense>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex justify-end border-b border-border bg-surface/80 px-4 py-3 backdrop-blur md:px-8">
          <Suspense>
            <DateRangePicker />
          </Suspense>
        </div>
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</main>
      </div>

      <Suspense>
        <ChatPanel />
      </Suspense>
    </div>
  );
}
