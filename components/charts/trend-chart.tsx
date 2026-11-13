"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { cn } from "@/lib/utils";

export type Series = { key: string; label: string; color: string };
type Datum = Record<string, string | number>;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR");

function compact(v: number, currency: boolean) {
  if (Math.abs(v) >= 1000) return `${currency ? "R$ " : ""}${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return currency ? `R$ ${int.format(v)}` : int.format(v);
}

type TooltipPayload = { dataKey?: string | number; value?: number | string; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
  series,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  series: Series[];
  currency: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-44 rounded-lg border border-border bg-card px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      <div className="grid gap-1">
        {series.map((s) => {
          const item = payload.find((p) => p.dataKey === s.key);
          return (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="num font-medium text-foreground">
                {currency ? brl.format(Number(item?.value ?? 0)) : int.format(Number(item?.value ?? 0))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Gráfico de tendência (área ou barras) com tooltip, legenda e tabela acessível. */
export function TrendChart({
  data,
  xKey,
  series,
  currency = false,
  variant = "area",
  height = 260,
  className,
  caption,
}: {
  data: Datum[];
  xKey: string;
  series: Series[];
  currency?: boolean;
  variant?: "area" | "bar";
  height?: number;
  className?: string;
  caption: string;
}) {
  const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };
  const common = { data, margin: { top: 8, right: 8, left: 0, bottom: 0 } };
  return (
    <div className={cn("w-full", className)}>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          {variant === "area" ? (
            <AreaChart {...common}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axisTick} dy={6} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={currency ? 76 : 32} tickFormatter={(v) => compact(Number(v), currency)} />
              <Tooltip
                cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
                content={<ChartTooltip series={series} currency={currency} />}
              />
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#grad-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  animationDuration={700}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart {...common} barGap={3}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axisTick} dy={6} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={currency ? 76 : 32}
                allowDecimals={false}
                tickFormatter={(v) => compact(Number(v), currency)}
              />
              <Tooltip cursor={{ fill: "var(--subtle)" }} content={<ChartTooltip series={series} currency={currency} />} />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={600} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Período</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={String(d[xKey])}>
              <th scope="row">{d[xKey]}</th>
              {series.map((s) => (
                <td key={s.key}>{currency ? brl.format(Number(d[s.key])) : d[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
