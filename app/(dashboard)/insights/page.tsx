import Link from "next/link";
import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageData } from "@/components/PageData";
import { InsightCard } from "@/components/InsightCard";
import { getBriefing, getInsights } from "@/lib/insights/report";
import { formatMoney } from "@/lib/format";
import type { PageContext } from "@/lib/page-context";

export default function InsightsPage({ searchParams }: PageProps<"/insights">) {
  return (
    <>
      <PageHeader
        title="AI insights"
        description="The system continuously scans all sources for money leaks and growth opportunities, and recommends concrete actions with their estimated monthly impact."
      />
      <PageData searchParams={searchParams}>{(ctx) => <Insights ctx={ctx} />}</PageData>
    </>
  );
}

async function Insights({ ctx }: { ctx: PageContext }) {
  const { currency, insights } = await getInsights(ctx.preset, ctx.today, ctx.creds);
  const totalImpact = insights.reduce((s, i) => s + i.impact, 0);

  return (
    <div className="space-y-6">
      {/* The LLM briefing is slower – stream it independently of the rule-based findings. */}
      <Suspense fallback={<Skeleton className="h-48" />}>
        <Briefing ctx={ctx} />
      </Suspense>

      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{insights.length} findings</h2>
        <p className="text-sm text-muted">
          Combined potential: <span className="font-semibold text-good">≈ {formatMoney(totalImpact, currency)}/month</span>
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {insights.map((i) => (
          <InsightCard key={i.id} insight={i} currency={currency} />
        ))}
      </div>
    </div>
  );
}

async function Briefing({ ctx }: { ctx: PageContext }) {
  const briefing = await getBriefing(ctx.preset, ctx.today, ctx.creds);
  if (!briefing) {
    return (
      <Card title="Executive briefing">
        <p className="text-sm text-muted">
          Add an AI key in{" "}
          <Link href="/settings" className="font-medium text-accent underline">
            Connections & Keys
          </Link>{" "}
          to get an AI-written weekly briefing on top of the findings below.
        </p>
      </Card>
    );
  }
  return (
    <Card title="Executive briefing" subtitle={`Written by ${briefing.model} from the findings below`}>
      <div className="prose-chat text-sm">
        <ReactMarkdown>{briefing.text}</ReactMarkdown>
      </div>
    </Card>
  );
}
