import Link from "next/link";
import type { SourceInfo } from "@/lib/domain/types";
import { localeHref } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/page";

/** Tells the viewer when (part of) the numbers come from demo data or a failing API. */
export async function DataSourceNotice({ sources }: { sources: SourceInfo[] }) {
  const mock = sources.filter((s) => s.status === "mock");
  const failing = sources.filter((s) => s.status === "error");
  if (!mock.length && !failing.length) return null;
  const { t, rich, locale } = await getI18n();
  const settings = localeHref(locale, "/settings");
  return (
    <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn" role="status">
      {failing.length > 0 && <p>{t("banner.apiError", { sources: failing.map((s) => s.name).join(", ") })}</p>}
      {mock.length > 0 && (
        <p>
          {rich("banner.demo", {
            sources: mock.map((s) => s.name).join(", "),
            connect: (
              <Link href={settings} className="font-medium underline">
                {t("banner.connect")}
              </Link>
            ),
            how: (
              <Link href={`${settings}#how-it-works`} className="underline">
                {t("banner.how")}
              </Link>
            ),
          })}
        </p>
      )}
    </div>
  );
}
