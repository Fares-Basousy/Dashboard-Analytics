"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatValue, type ValueFormat } from "@/lib/format";
import { axisProps, compactNumber, SERIES_COLORS, tooltipProps } from "./chart-theme";

export interface Series<T> {
  key: keyof T & string;
  label: string;
}

interface TrendChartProps<T> {
  data: T[];
  xKey: keyof T & string;
  series: Series<T>[];
  format?: ValueFormat;
  currency: string;
  height?: number;
}

/** Time series as overlaid areas (e.g. revenue vs. net profit vs. ad spend). */
export function TrendChart<T extends object>({ data, xKey, series, format = "money", currency, height = 280 }: TrendChartProps<T>) {
  // Recharts types keys against its own data shape; our keys are already checked against T above.
  const rows = data as unknown as Record<string, unknown>[];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLORS[i]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={SERIES_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey as string} {...axisProps} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis {...axisProps} tickFormatter={compactNumber} width={44} />
        <Tooltip {...tooltipProps} formatter={(v) => formatValue(format, Number(v), currency)} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key as string}
            name={s.label}
            stroke={SERIES_COLORS[i]}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
