import { Card } from "@/components/ui/Card";
import { CREDENTIAL_COOKIE_DAYS } from "@/lib/credentials/store";

const WITHOUT_KEYS = [
  ["Data sources", "Every source without keys shows realistic demo data for a spare-parts shop. Pages say which sources are demo, and you can mix: connect Shopify and keep the ads on demo data."],
  ["AI assistant", "Without an AI key, the chat runs in a rule-based demo mode. It still analyses the data through the same tools and answers with real findings, just without an AI model writing the text."],
  ["Failures", "If a connected source's API fails, that source falls back to demo data and a warning banner appears. The dashboard never goes down because of one source."],
] as const;

const STORAGE = [
  ["Encrypted", "Keys are encrypted with AES-256-GCM before they leave the server. The stored value is useless without the server's secret."],
  ["httpOnly cookie", `They are saved in one cookie that JavaScript cannot read, sent only to this site (sameSite), only over HTTPS in production, and kept for ${CREDENTIAL_COOKIE_DAYS} days.`],
  ["Never shown again", "Keys are decrypted only on the server, to call the APIs. This page only shows where a key comes from (browser, server or not set), never its value."],
  ["Your browser only", "Saved keys belong to this browser. Other visitors don't see or use them. Keys set by the site owner on the server are used when the browser has none."],
  ["Remove anytime", "Use “Remove” on a card, or “Forget all keys” below, to delete them immediately."],
] as const;

function Points({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="space-y-3">
      {items.map(([term, text]) => (
        <div key={term}>
          <dt className="text-sm font-medium">{term}</dt>
          <dd className="text-sm text-muted">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Plain-language explanation of demo mode and key storage, shown on the settings page. */
export function KeysExplainer() {
  return (
    <div id="how-it-works" className="grid scroll-mt-6 gap-6 lg:grid-cols-2">
      <Card title="Works without any keys" subtitle="Try everything first, connect later.">
        <Points items={WITHOUT_KEYS} />
      </Card>
      <Card title="How your keys are stored" subtitle="Security by design.">
        <Points items={STORAGE} />
      </Card>
    </div>
  );
}
