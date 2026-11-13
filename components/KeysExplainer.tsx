import { Card } from "@/components/ui/Card";
import { CREDENTIAL_COOKIE_DAYS } from "@/lib/credentials/store";
import { getI18n } from "@/lib/i18n/page";
import type { MessageKey } from "@/lib/i18n/messages/en";

type Point = readonly [term: MessageKey, text: MessageKey];

const WITHOUT_KEYS: Point[] = [
  ["explainer.dataSources", "explainer.dataSourcesText"],
  ["explainer.ai", "explainer.aiText"],
  ["explainer.failures", "explainer.failuresText"],
  ["explainer.translations", "explainer.translationsText"],
];

const STORAGE: Point[] = [
  ["explainer.encrypted", "explainer.encryptedText"],
  ["explainer.cookie", "explainer.cookieText"],
  ["explainer.never", "explainer.neverText"],
  ["explainer.browser", "explainer.browserText"],
  ["explainer.remove", "explainer.removeText"],
];

/** Plain-language explanation of demo mode, key storage and languages, shown on the settings page. */
export async function KeysExplainer() {
  const { t } = await getI18n();
  const points = (items: Point[]) => (
    <dl className="space-y-3">
      {items.map(([term, text]) => (
        <div key={term}>
          <dt className="text-sm font-medium">{t(term)}</dt>
          <dd className="text-sm text-muted">{t(text, { days: CREDENTIAL_COOKIE_DAYS })}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div id="how-it-works" className="grid scroll-mt-6 gap-6 lg:grid-cols-2">
      <Card title={t("explainer.withoutTitle")} subtitle={t("explainer.withoutSubtitle")}>
        {points(WITHOUT_KEYS)}
      </Card>
      <Card title={t("explainer.storedTitle")} subtitle={t("explainer.storedSubtitle")}>
        {points(STORAGE)}
      </Card>
    </div>
  );
}
