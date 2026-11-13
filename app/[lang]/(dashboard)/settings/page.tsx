import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { CredentialForm } from "@/components/CredentialForm";
import { KeysExplainer } from "@/components/KeysExplainer";
import { SeedPanel } from "@/components/SeedPanel";
import { CONNECTORS } from "@/lib/connectors/registry";
import { CREDENTIAL_GROUPS, isGroupConfigured, type CredentialGroup, type Credentials } from "@/lib/credentials/fields";
import { getCredentials, getCredentialSources } from "@/lib/credentials/store";
import { getI18n } from "@/lib/i18n/page";
import type { MessageKey } from "@/lib/i18n/messages/en";
import type { Translator } from "@/lib/i18n/translate";
import type { Tone } from "@/lib/tone";
import { forgetAllCredentials } from "./actions";

export default async function SettingsPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <div className="mb-6">
        <KeysExplainer />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Settings />
      </Suspense>
    </>
  );
}

function connectorStatus(c: (typeof CONNECTORS)[number], creds: Credentials): { tone: Tone; labelKey: MessageKey } {
  if (c.planned) return { tone: "neutral", labelKey: "status.planned" };
  if (c.credentialGroup && isGroupConfigured(c.credentialGroup, creds)) return { tone: "good", labelKey: "status.connected" };
  return { tone: "warn", labelKey: "status.demo" };
}

/** Field labels and descriptions in the page language (the form itself is a client component). */
function translateGroup(g: CredentialGroup, t: Translator["t"]): CredentialGroup {
  return {
    ...g,
    title: t(`group.${g.id}.title`),
    description: t(`group.${g.id}.description`),
    fields: g.fields.map((f) => ({ ...f, label: t(`field.${f.key}` as MessageKey) })),
  };
}

async function Settings() {
  const [{ t }, creds, sources] = await Promise.all([getI18n(), getCredentials(), getCredentialSources()]);

  return (
    <div className="space-y-6">
      <Card title={t("settings.sources")} subtitle={t("settings.sourcesHint")}>
        <ul className="divide-y divide-border">
          {CONNECTORS.map((c) => {
            const status = connectorStatus(c, creds);
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 py-2.5" data-testid="source">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted">{t(`source.${c.id}` as MessageKey)}</p>
                </div>
                <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title={t("settings.testData")} subtitle={t("settings.testDataHint")}>
        <SeedPanel enabled={isGroupConfigured("shopify", creds)} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {CREDENTIAL_GROUPS.map((g) => {
          const group = translateGroup(g, t);
          return (
            <Card key={g.id} title={group.title} subtitle={group.description}>
              <CredentialForm group={group} sources={sources} />
            </Card>
          );
        })}
      </div>

      <form action={forgetAllCredentials}>
        <button type="submit" className="text-sm text-bad hover:underline">
          {t("settings.forgetAll")}
        </button>
      </form>
    </div>
  );
}
