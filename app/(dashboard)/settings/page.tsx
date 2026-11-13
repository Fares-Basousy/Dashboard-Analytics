import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { CredentialForm } from "@/components/CredentialForm";
import { KeysExplainer } from "@/components/KeysExplainer";
import { CONNECTORS } from "@/lib/connectors/registry";
import { CREDENTIAL_GROUPS, isGroupConfigured, type Credentials } from "@/lib/credentials/fields";
import { getCredentials, getCredentialSources } from "@/lib/credentials/store";
import type { Tone } from "@/lib/tone";
import { forgetAllCredentials } from "./actions";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Connections & keys"
        description="Connect your accounts and AI model. Everything works without keys – connect only what you want to see live."
      />
      <div className="mb-6">
        <KeysExplainer />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Settings />
      </Suspense>
    </>
  );
}

function connectorStatus(c: (typeof CONNECTORS)[number], creds: Credentials): { tone: Tone; label: string } {
  if (c.planned) return { tone: "neutral", label: "planned" };
  if (c.credentialGroup && isGroupConfigured(c.credentialGroup, creds)) return { tone: "good", label: "connected" };
  return { tone: "warn", label: "demo data" };
}

async function Settings() {
  const [creds, sources] = await Promise.all([getCredentials(), getCredentialSources()]);

  return (
    <div className="space-y-6">
      <Card title="Data sources" subtitle="New sources plug in through one Connector interface – no UI or AI changes needed.">
        <ul className="divide-y divide-border">
          {CONNECTORS.map((c) => {
            const status = connectorStatus(c, creds);
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 py-2.5" data-testid="source">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted">{c.provides}</p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {CREDENTIAL_GROUPS.map((g) => (
          <Card key={g.id} title={g.title} subtitle={g.description}>
            <CredentialForm group={g} sources={sources} />
          </Card>
        ))}
      </div>

      <form action={forgetAllCredentials}>
        <button type="submit" className="text-sm text-bad hover:underline">
          Forget all keys saved in this browser
        </button>
      </form>
    </div>
  );
}
