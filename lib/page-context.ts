import "server-only";
import { connection } from "next/server";
import { getCredentials } from "@/lib/credentials/store";
import { DEFAULT_PRESET, isPreset, presetRange, previousRange, toISODate } from "@/lib/date-range";
import { RANGE_PARAM } from "@/lib/navigation";
import { getI18n } from "@/lib/i18n/page";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Everything a dashboard page needs about the current request, resolved in one place. */
export async function resolvePageContext(searchParams: SearchParams) {
  // "Today" is request-time data: opt in explicitly before reading the clock (Cache Components).
  await connection();
  const value = (await searchParams)[RANGE_PARAM];
  const preset = isPreset(value) ? value : DEFAULT_PRESET;
  const today = toISODate(new Date());
  const range = presetRange(preset, today);
  const [creds, i18n] = await Promise.all([getCredentials(), getI18n()]);
  return { preset, today, range, previous: previousRange(range), creds, i18n, locale: i18n.locale };
}

export type PageContext = Awaited<ReturnType<typeof resolvePageContext>>;
