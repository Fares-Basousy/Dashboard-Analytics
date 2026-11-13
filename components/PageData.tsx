import { Suspense, type ReactNode } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { resolvePageContext, type PageContext, type SearchParams } from "@/lib/page-context";

interface PageDataProps {
  searchParams: SearchParams;
  children: (ctx: PageContext) => Promise<ReactNode> | ReactNode;
  fallback?: ReactNode;
}

/**
 * Streams the request-dependent part of a page (period + credentials) behind a Suspense boundary,
 * so the page shell is prerendered (Cache Components) and every page resolves context the same way.
 */
export function PageData({ searchParams, children, fallback = <PageSkeleton /> }: PageDataProps) {
  return (
    <Suspense fallback={fallback}>
      <Resolve searchParams={searchParams}>{children}</Resolve>
    </Suspense>
  );
}

async function Resolve({ searchParams, children }: Omit<PageDataProps, "fallback">) {
  return children(await resolvePageContext(searchParams));
}
