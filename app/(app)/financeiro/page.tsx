import { AlertTriangle, CalendarClock, Clock3, HandCoins, Repeat } from "lucide-react";
import type { Metadata } from "next";

import { TrendChart } from "@/components/charts/trend-chart";
import { Pagination, pageHref } from "@/components/clients/pagination";
import { Delta, KpiCard, percentChange } from "@/components/dashboard/kpi-card";
import { FinanceToolbar } from "@/components/finance/finance-toolbar";
import { ReceivablesTable } from "@/components/finance/receivables-table";
import { SearchFilters } from "@/components/finance/search-filters";
import { StatusTabs } from "@/components/finance/status-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { receivableFiltersSchema } from "@/schemas/finance";
import {
  RECEIVABLES_PAGE_SIZE,
  getFinanceSummary,
  listClientOptions,
  searchReceivables,
} from "@/services/finance";
import { monthLabel } from "@/utils/dates";
import { formatBRL } from "@/utils/money";

export const metadata: Metadata = { title: "Financeiro" };

const TABS = [
  { value: "a_vencer", label: "A receber", dot: "var(--faint)" },
  { value: "vence_em_breve", label: "Vence em 7 dias", dot: "var(--warning)" },
  { value: "vencido", label: "Vencidas", dot: "var(--danger)" },
  { value: "pago", label: "Recebidas", dot: "var(--success)" },
  { value: "cancelado", label: "Canceladas" },
];

export default async function FinancePage({ searchParams }: PageProps<"/financeiro">) {
  const ctx = await requireOrgContext();
  const filters = receivableFiltersSchema.parse(await searchParams);
  const canWrite = can(ctx.role, "finance:write");
  const [summary, result, clients] = await Promise.all([
    getFinanceSummary(ctx.organization.id),
    searchReceivables(ctx.organization.id, {
      q: filters.q,
      status: filters.status,
      competence: filters.competencia,
      page: filters.page,
    }),
    canWrite ? listClientOptions(ctx.organization.id) : Promise.resolve([]),
  ]);
  const keep = { q: filters.q, status: filters.status, competencia: filters.competencia };
  const series = summary.received_by_month;
  const recNow = series.at(-1)?.received ?? 0;
  const recPrev = series.at(-2)?.received ?? 0;
  const billed6 = series.reduce((a, m) => a + m.billed, 0);
  const received6 = series.reduce((a, m) => a + m.received, 0);
  const rate = billed6 ? Math.min(100, (received6 / billed6) * 100) : null;
  const notOverdueOpen = Math.max(0, summary.open_total - summary.overdue_total - summary.due_soon_total);

  return (
    <>
      <PageHeader
        eyebrow="Faturamento"
        title="Financeiro"
        description="Contas a receber dos honorários: faturamento por contrato, cobranças avulsas e recebimentos."
        actions={canWrite && <FinanceToolbar clients={clients} />}
      />

      <section aria-label="Indicadores financeiros" className="enter-stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiCard
          label="A receber"
          value={summary.open_total}
          format="currency"
          icon={CalendarClock}
          tone="neutral"
          href="/financeiro?status=a_vencer"
          footer={<span className="text-xs text-muted-foreground">{summary.open_count} cobrança(s) em aberto</span>}
        />
        <KpiCard
          label="Vence em 7 dias"
          value={summary.due_soon_total}
          format="currency"
          icon={Clock3}
          tone="warning"
          href="/financeiro?status=vence_em_breve"
          footer={<span className="text-xs text-muted-foreground">{summary.due_soon_count} cobrança(s) pendente(s)</span>}
        />
        <KpiCard
          label="Vencido"
          value={summary.overdue_total}
          format="currency"
          icon={AlertTriangle}
          tone="danger"
          href="/financeiro?status=vencido"
          footer={<span className="text-xs text-muted-foreground">{summary.overdue_count} cobrança(s) em atraso</span>}
        />
        <KpiCard
          label="Recebido no mês"
          value={recNow}
          format="currency"
          icon={HandCoins}
          tone="success"
          href="/financeiro?status=pago"
          footer={<Delta value={percentChange(recNow, recPrev)} />}
        />
        <KpiCard
          className="col-span-2 lg:col-span-1"
          label="Receita recorrente mensal"
          value={summary.mrr}
          format="currency"
          icon={Repeat}
          tone="dark"
          href="/contratos?status=ativo"
          footer={<span className="text-xs text-sidebar-muted">{summary.active_contracts} contrato(s) ativo(s)</span>}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Faturado e recebido</CardTitle>
            <CardDescription>Faturado por competência e recebido pela data do pagamento, últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              caption="Faturado e recebido por mês"
              currency
              variant="bar"
              xKey="mes"
              data={series.map((m) => ({ mes: monthLabel(m.month), faturado: m.billed, recebido: m.received }))}
              series={[
                { key: "faturado", label: "Faturado", color: "var(--chart-1)" },
                { key: "recebido", label: "Recebido", color: "var(--success)" },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saúde da carteira</CardTitle>
            <CardDescription>Composição do saldo em aberto</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-subtle">
                {summary.open_total > 0 && (
                  <>
                    <span className="h-full bg-faint transition-[width] duration-700" style={{ width: `${(notOverdueOpen / summary.open_total) * 100}%` }} />
                    <span className="h-full bg-warning transition-[width] duration-700" style={{ width: `${(summary.due_soon_total / summary.open_total) * 100}%` }} />
                    <span className="h-full bg-danger transition-[width] duration-700" style={{ width: `${(summary.overdue_total / summary.open_total) * 100}%` }} />
                  </>
                )}
              </div>
              <ul className="mt-4 grid gap-2.5 text-[13px]">
                {[
                  { label: "A receber (mais de 7 dias)", value: notOverdueOpen, color: "var(--faint)" },
                  { label: "Vence em até 7 dias", value: summary.due_soon_total, color: "var(--warning)" },
                  { label: "Vencido", value: summary.overdue_total, color: "var(--danger)" },
                ].map((i) => (
                  <li key={i.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: i.color }} />
                      {i.label}
                    </span>
                    <span className="num font-medium">{formatBRL(i.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-subtle/50 p-4">
              <p className="text-xs text-muted-foreground">Taxa de recebimento · 6 meses</p>
              <p className="num mt-1 text-2xl font-semibold tracking-tight">
                {rate === null ? "—" : `${rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBRL(received6)} recebidos de {formatBRL(billed6)} faturados
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="mt-4 overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4">
          <StatusTabs basePath="/financeiro" param="status" current={filters.status} options={TABS} keep={keep} />
          <SearchFilters placeholder="Pesquisar por cliente, CNPJ ou descrição…" monthParam={{ param: "competencia", label: "Competência" }} />
        </div>
        <ReceivablesTable rows={result.rows} canWrite={canWrite} />
        <div className="border-t border-border px-4 sm:px-5">
          {result.total > 0 && (
            <p className="pt-3 text-[13px] text-muted-foreground">
              Total filtrado: <strong className="num font-semibold text-foreground">{formatBRL(result.totalAmount)}</strong>
            </p>
          )}
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={RECEIVABLES_PAGE_SIZE}
            buildHref={(p) => pageHref("/financeiro", keep, p)}
          />
        </div>
      </Card>
    </>
  );
}
