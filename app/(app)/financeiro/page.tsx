import { AlertTriangle, CalendarClock, HandCoins, Repeat } from "lucide-react";
import type { Metadata } from "next";

import { Pagination, pageHref } from "@/components/clients/pagination";
import { FinanceToolbar } from "@/components/finance/finance-toolbar";
import { ReceivablesTable } from "@/components/finance/receivables-table";
import { RevenueChart } from "@/components/finance/revenue-chart";
import { SearchFilters } from "@/components/finance/search-filters";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { receivableFiltersSchema } from "@/schemas/finance";
import {
  RECEIVABLES_PAGE_SIZE,
  getFinanceSummary,
  listClientOptions,
  searchReceivables,
} from "@/services/finance";
import { RECEIVABLE_FILTER_LABELS, RECEIVABLE_FILTERS } from "@/types/domain";
import { formatBRL } from "@/utils/money";

export const metadata: Metadata = { title: "Financeiro" };

function MoneyCard({ label, value, hint, icon: Icon, tone }: {
  label: string; value: number; hint: string; icon: typeof HandCoins; tone?: "danger" | "dark";
}) {
  return (
    <Card className={tone === "dark" ? "border-brand-graphite bg-brand-graphite p-5 text-white" : "p-5"}>
      <div className="flex items-start justify-between gap-2">
        <p className={tone === "dark" ? "text-sm font-medium text-sidebar-foreground" : "text-sm font-medium text-muted-foreground"}>{label}</p>
        <Icon className={tone === "danger" ? "size-4 text-destructive" : tone === "dark" ? "size-4 text-brand-red" : "size-4 text-muted-foreground"} />
      </div>
      <p className={`mt-3 font-serif text-2xl font-semibold tabular-nums sm:text-3xl ${tone === "danger" && value > 0 ? "text-destructive" : ""}`}>
        {formatBRL(value)}
      </p>
      <p className={tone === "dark" ? "mt-1 text-xs text-sidebar-muted" : "mt-1 text-xs text-muted-foreground"}>{hint}</p>
    </Card>
  );
}

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

  return (
    <>
      <PageHeader
        eyebrow="Faturamento"
        title="Financeiro"
        description="Contas a receber dos honorários: faturamento por contrato, cobranças avulsas e pagamentos."
        actions={canWrite && <FinanceToolbar clients={clients} />}
      />

      <section aria-label="Indicadores financeiros" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MoneyCard label="A receber" value={summary.open_total} hint={`${summary.open_count} cobrança(s) em aberto`} icon={CalendarClock} tone="dark" />
        <MoneyCard label="Vencido" value={summary.overdue_total} hint={`${summary.overdue_count} cobrança(s) em atraso`} icon={AlertTriangle} tone="danger" />
        <MoneyCard label="Recebido no mês" value={summary.month_received} hint={`Faturado no mês: ${formatBRL(summary.month_billed)}`} icon={HandCoins} />
        <MoneyCard label="Receita recorrente mensal" value={summary.mrr} hint={`${summary.active_contracts} contrato(s) ativo(s)`} icon={Repeat} />
      </section>

      <section className="mt-6">
        <RevenueChart data={summary.received_by_month} />
      </section>

      <Card className="mt-6 p-4 sm:p-5">
        <SearchFilters
          placeholder="Pesquisar por cliente, CNPJ ou descrição…"
          monthParam={{ param: "competencia", label: "Competência" }}
          selects={[
            {
              param: "status",
              label: "Situação da cobrança",
              allLabel: "Todas as situações",
              options: RECEIVABLE_FILTERS.map((s) => ({ value: s, label: RECEIVABLE_FILTER_LABELS[s] })),
            },
          ]}
        />
        <div className="-mx-4 mt-4 border-t sm:-mx-5">
          <ReceivablesTable rows={result.rows} canWrite={canWrite} />
        </div>
        <div className="flex flex-col gap-1">
          {result.total > 0 && (
            <p className="pt-4 text-sm text-muted-foreground">
              Total filtrado: <strong className="text-foreground tabular-nums">{formatBRL(result.totalAmount)}</strong>
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
