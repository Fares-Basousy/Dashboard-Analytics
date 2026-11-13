import Link from "next/link";
import type { SourceInfo } from "@/lib/domain/types";

/** Tells the viewer when (part of) the numbers come from demo data or a failing API. */
export function DataSourceNotice({ sources }: { sources: SourceInfo[] }) {
  const mock = sources.filter((s) => s.status === "mock");
  const failing = sources.filter((s) => s.status === "error");
  if (!mock.length && !failing.length) return null;
  return (
    <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn" role="status">
      {failing.length > 0 && <p>⚠ {failing.map((s) => s.name).join(", ")}: API error – showing demo data instead.</p>}
      {mock.length > 0 && (
        <p>
          Demo data for {mock.map((s) => s.name).join(", ")}.{" "}
          <Link href="/settings" className="font-medium underline">
            Connect your accounts
          </Link>{" "}
          to see real numbers.{" "}
          <Link href="/settings#how-it-works" className="underline">
            How demo mode works
          </Link>
        </p>
      )}
    </div>
  );
}
