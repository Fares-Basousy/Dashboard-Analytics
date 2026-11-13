"use client";

import { useActionState } from "react";
import { saveCredentials, type FormState } from "@/app/(dashboard)/settings/actions";
import type { CredentialGroup, CredentialSource } from "@/lib/credentials/fields";
import { Badge } from "@/components/ui/Badge";

const SOURCE_BADGE: Record<CredentialSource, { tone: "good" | "info" | "neutral"; label: string }> = {
  cookie: { tone: "good", label: "saved in browser" },
  env: { tone: "info", label: "set on server" },
  none: { tone: "neutral", label: "not set" },
};

interface Props {
  group: CredentialGroup;
  /** Where each key currently comes from. Values never reach the client. */
  sources: Record<string, CredentialSource>;
}

export function CredentialForm({ group, sources }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCredentials, null);
  const hasSaved = group.fields.some((f) => sources[f.key] === "cookie");

  return (
    <form action={action} className="space-y-3" data-testid={`credentials-${group.id}`}>
      <input type="hidden" name="group" value={group.id} />
      {group.fields.map((f) => (
        <label key={f.key} className="block">
          <span className="flex items-center justify-between text-xs font-medium text-muted">
            {f.label}
            <Badge tone={SOURCE_BADGE[sources[f.key]].tone}>{SOURCE_BADGE[sources[f.key]].label}</Badge>
          </span>
          <input
            name={f.key}
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            spellCheck={false}
            pattern={f.pattern}
            placeholder={sources[f.key] === "none" ? f.placeholder : "•••••••• (leave empty to keep)"}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
      ))}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" name="intent" value="save" disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        {hasSaved && (
          <button type="submit" name="intent" value="clear" disabled={pending} className="text-sm text-bad hover:underline">
            Remove
          </button>
        )}
        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-good" : "text-bad"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
