"use client";

import { useMemo, useState } from "react";
import { formatValue, type ValueFormat } from "@/lib/format";
import { TONE_TEXT, toneFor, type ToneRule } from "@/lib/tone";
import { useI18n } from "@/components/I18nProvider";

/** Serializable column config, so Server Components can define tables without passing functions. */
export interface Column<T> {
  key: keyof T & string;
  label: string;
  format?: ValueFormat;
  tone?: ToneRule;
  /** Secondary line under the value (e.g. SKU under the title). */
  subKey?: keyof T & string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: keyof T & string;
  defaultSort?: { key: keyof T & string; dir: "asc" | "desc" };
  /** Rows visible before "Show all". */
  pageSize?: number;
  testId?: string;
  /** Currency for `money` columns. */
  currency: string;
}

export function DataTable<T extends object>({ rows, columns, rowKey, defaultSort, pageSize = 15, testId, currency }: DataTableProps<T>) {
  const { t } = useI18n();
  const [sort, setSort] = useState(defaultSort);
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, sort]);

  const visible = expanded ? sorted : sorted.slice(0, pageSize);

  const toggleSort = (key: keyof T & string) =>
    setSort((s) => ({ key, dir: s?.key === key && s.dir === "desc" ? "asc" : "desc" }));

  return (
    <div data-testid={testId}>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              {columns.map((c) => (
                <th key={c.key} className={`px-5 py-2 font-medium ${c.format && c.format !== "text" ? "text-right" : "text-left"}`}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-text">
                    {c.label}
                    <span aria-hidden className="w-2">{sort?.key === c.key ? (sort.dir === "desc" ? "↓" : "↑") : ""}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={String(row[rowKey])} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
                {columns.map((c) => {
                  const value = row[c.key];
                  const numeric = c.format && c.format !== "text";
                  const tone = c.tone && typeof value === "number" ? TONE_TEXT[toneFor(c.tone, value)] : "";
                  return (
                    <td key={c.key} className={`px-5 py-2.5 ${numeric ? "text-right tabular-nums" : ""} ${tone}`}>
                      {formatValue(c.format ?? "text", value, currency)}
                      {c.subKey && <div className="text-xs text-muted">{String(row[c.subKey])}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-3 text-xs font-medium text-accent hover:underline">
          {expanded ? t("table.showLess") : t("table.showAll", { count: rows.length })}
        </button>
      )}
    </div>
  );
}
