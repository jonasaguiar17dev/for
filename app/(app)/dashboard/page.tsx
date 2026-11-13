import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CircleCheck,
  CirclePause,
  CircleX,
  HandCoins,
  Plus,
  Repeat,
  Rocket,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BarList } from "@/components/charts/bar-list";
import { TrendChart } from "@/components/charts/trend-chart";
import { ContractStatusBadge } from "@/components/clients/status-badges";
import { Delta, KpiCard, percentChange } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getDashboardSummary } from "@/services/dashboard";
import { getFinanceSummary } from "@/services/finance";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES, TAX_REGIME_LABELS, TAX_REGIMES } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { monthLabel } from "@/utils/dates";
import { formatDate } from "@/utils/format";
import { formatBRL } from "@/utils/money";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS_COLOR = {
  ativo: "var(--success)",
  em_implantacao: "var(--info)",
  suspenso: "var(--warning)",
  encerrado: "var(--faint)",
} as const;

function greeting() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await requireOrgContext();
  const [summary, finance] = await Promise.all([
    getDashboardSummary(ctx.organization.id),
    getFinanceSummary(ctx.organization.id),
  ]);
  const { erro } = await searchParams;
  const byStatus = (s: (typeof CONTRACT_STATUSES)[number]) => summary.clients_by_status[s] ?? 0;
  const newClients = summary.new_clients_by_month ?? [];
  const thisMonth = newClients.at(-1)?.count ?? 0;
  const lastMonth = newClients.at(-2)?.count ?? 0;
  const series = finance.received_by_month;
  const recNow = series.at(-1)?.received ?? 0;
  const recPrev = series.at(-2)?.received ?? 0;
  const billedNow = series.at(-1)?.billed ?? 0;
  const billedPrev = series.at(-2)?.billed ?? 0;
  const regimes = TAX_REGIMES.map((r) => ({ label: TAX_REGIME_LABELS[r], value: summary.companies_by_regime[r] ?? 0, href: `/empresas?regime=${r}` }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        eyebrow={`${greeting()} · ${ctx.organization.name}`}
        title="Visão geral"
        description="Indicadores calculados em tempo real a partir dos dados que você pode acessar."
        actions={
          can(ctx.role, "company:create") && (
            <Button asChild>
              <Link href="/clientes/novo">
                <Plus /> Novo cliente
              </Link>
            </Button>
          )
        }
      />
      {erro === "permissao" && (
        <Alert variant="destructive" className="mb-6">
          Você não tem permissão para acessar aquela área.
        </Alert>
      )}

      <section aria-label="Carteira de clientes" className="enter-stagger grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          className="col-span-2 md:col-span-1"
          label="Empresas cadastradas"
          value={summary.total_companies}
          icon={Building2}
          tone="dark"
          href="/empresas"
          footer={<Delta dark value={percentChange(thisMonth, lastMonth)} label={`${thisMonth} novo(s) no mês`} />}
        />
        <KpiCard label="Clientes ativos" value={byStatus("ativo")} icon={CircleCheck} tone="success" href="/clientes?status=ativo" />
        <KpiCard label="Em implantação" value={byStatus("em_implantacao")} icon={Rocket} tone="neutral" href="/clientes?status=em_implantacao" />
        <KpiCard label="Suspensos" value={byStatus("suspenso")} icon={CirclePause} tone="warning" href="/clientes?status=suspenso" />
        <KpiCard label="Encerrados" value={byStatus("encerrado")} icon={CircleX} tone="neutral" href="/clientes?status=encerrado" />
      </section>

      <section aria-label="Financeiro" className="enter-stagger mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="A receber"
          value={finance.open_total}
          format="currency"
          icon={CalendarClock}
          href="/financeiro?status=a_vencer"
          footer={<span className="text-xs text-muted-foreground">{finance.open_count} cobrança(s) em aberto</span>}
        />
        <KpiCard
          label="Vencido"
          value={finance.overdue_total}
          format="currency"
          icon={AlertTriangle}
          tone="danger"
          href="/financeiro?status=vencido"
          footer={<span className="text-xs text-muted-foreground">{finance.overdue_count} cobrança(s) em atraso</span>}
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
          label="Receita recorrente mensal"
          value={finance.mrr}
          format="currency"
          icon={Repeat}
          href="/contratos?status=ativo"
          footer={<span className="text-xs text-muted-foreground">{finance.active_contracts} contrato(s) ativo(s)</span>}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Faturado e recebido</CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </div>
            <div className="text-right">
              <p className="num text-lg font-semibold tracking-tight">{formatBRL(billedNow)}</p>
              <Delta value={percentChange(billedNow, billedPrev)} label="faturado vs. mês anterior" />
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart
              caption="Faturado e recebido por mês"
              currency
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
            <CardTitle>Clientes por situação</CardTitle>
            <CardDescription>Relação contratual com o escritório</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={CONTRACT_STATUSES.map((s) => ({
                label: CONTRACT_STATUS_LABELS[s],
                value: byStatus(s),
                color: STATUS_COLOR[s],
                href: `/clientes?status=${s}`,
              }))}
              emptyText="Nenhum cliente cadastrado ainda."
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Novos clientes</CardTitle>
              <CardDescription>Cadastrados por mês</CardDescription>
            </div>
            <Delta value={percentChange(thisMonth, lastMonth)} label="no mês" />
          </CardHeader>
          <CardContent>
            <TrendChart
              caption="Novos clientes por mês"
              variant="bar"
              height={180}
              xKey="mes"
              data={newClients.map((m) => ({ mes: monthLabel(m.month), clientes: m.count }))}
              series={[{ key: "clientes", label: "Novos clientes", color: "var(--chart-1)" }]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Regime tributário</CardTitle>
            <CardDescription>Empresas de clientes (sem o CNPJ interno)</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={regimes} emptyText="Nenhuma empresa cadastrada ainda." />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Cadastrados recentemente</CardTitle>
              <CardDescription>Últimos clientes</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/clientes">
                Ver todos <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-3">
            {summary.recent_clients.length === 0 ? (
              <EmptyState icon={Building2} title="Nenhum cliente ainda" description="Os clientes cadastrados aparecem aqui." className="py-8" />
            ) : (
              <ul className="-mx-2 grid min-w-0">
                {summary.recent_clients.map((c) => (
                  <li key={c.company_id} className="min-w-0">
                    <Link
                      href={`/clientes/${c.company_id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-subtle"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-xs font-semibold text-muted-foreground">
                        {c.corporate_name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.corporate_name}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {formatCnpj(c.cnpj)} · {formatDate(c.created_at)}
                        </span>
                      </span>
                      <ContractStatusBadge status={c.contract_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
