"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatValue, type ValueFormat } from "@/lib/format";
import { axisProps, compactNumber, tooltipProps } from "./chart-theme";

export interface RankedBar {
  label: string;
  value: number;
}

/** Horizontal bars; negative values are red, positive green (profit rankings). */
export function RankedBarChart({ data, format = "chf" }: { data: RankedBar[]; format?: ValueFormat }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={compactNumber} />
        <YAxis type="category" dataKey="label" {...axisProps} width={190} tick={{ fontSize: 11, fill: "var(--text)" }} />
        <Tooltip {...tooltipProps} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => formatValue(format, Number(v))} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.value < 0 ? "var(--bad)" : "var(--good)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
