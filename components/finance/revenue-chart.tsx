"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MONTH_LABELS } from "@/types/domain";
import { formatBRL } from "@/utils/money";

/** Faturado × recebido nos últimos 6 meses (mesma unidade, mesmo eixo). */
export function RevenueChart({ data }: { data: { month: string; billed: number; received: number }[] }) {
  const rows = data.map((d) => ({
    label: `${MONTH_LABELS[Number(d.month.slice(5, 7)) - 1]}/${d.month.slice(2, 4)}`,
    Faturado: d.billed,
    Recebido: d.received,
  }));
  const empty = rows.every((r) => !r.Faturado && !r.Recebido);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Faturado e recebido</CardTitle>
        <CardDescription>Últimos 6 meses, por competência (faturado) e data de pagamento (recebido).</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem cobranças nos últimos 6 meses.</p>
        ) : (
          <div className="h-64" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(v))}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(v) => formatBRL(Number(v))}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Faturado" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Recebido" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <table className="sr-only">
          <caption>Faturado e recebido por mês</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{formatBRL(r.Faturado)}</td>
                <td>{formatBRL(r.Recebido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
