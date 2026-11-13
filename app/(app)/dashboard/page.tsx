import { Building2, CircleCheck, CirclePause, CircleX, Plus, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContractStatusBadge } from "@/components/clients/status-badges";
import { BarChartCard } from "@/components/dashboard/bar-chart-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getDashboardSummary } from "@/services/dashboard";
import { getFinanceSummary } from "@/services/finance";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES, TAX_REGIME_LABELS, TAX_REGIMES } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatDate } from "@/utils/format";
import { formatBRL } from "@/utils/money";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await requireOrgContext();
  const [summary, finance] = await Promise.all([
    getDashboardSummary(ctx.organization.id),
    getFinanceSummary(ctx.organization.id),
  ]);
  const { erro } = await searchParams;
  const byStatus = (s: (typeof CONTRACT_STATUSES)[number]) => summary.clients_by_status[s] ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard"
        description={`Indicadores de ${ctx.organization.name}, calculados em tempo real.`}
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

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-1">
          <StatCard label="Empresas cadastradas" value={summary.total_companies} icon={Building2} href="/empresas" emphasis />
        </div>
        <StatCard label="Clientes ativos" value={byStatus("ativo")} icon={CircleCheck} href="/clientes?status=ativo" />
        <StatCard label="Em implantação" value={byStatus("em_implantacao")} icon={Rocket} href="/clientes?status=em_implantacao" />
        <StatCard label="Suspensos" value={byStatus("suspenso")} icon={CirclePause} href="/clientes?status=suspenso" />
        <StatCard label="Encerrados" value={byStatus("encerrado")} icon={CircleX} href="/clientes?status=encerrado" />
      </section>

      <section aria-label="Financeiro" className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {(
          [
            { label: "A receber", value: finance.open_total, hint: `${finance.open_count} em aberto`, href: "/financeiro?status=a_vencer" },
            { label: "Vencido", value: finance.overdue_total, hint: `${finance.overdue_count} em atraso`, href: "/financeiro?status=vencido", alert: true },
            { label: "Recebido no mês", value: finance.month_received, hint: `faturado ${formatBRL(finance.month_billed)}`, href: "/financeiro?status=pago" },
            { label: "Receita recorrente", value: finance.mrr, hint: `${finance.active_contracts} contrato(s) ativo(s)`, href: "/contratos?status=ativo" },
          ] as { label: string; value: number; hint: string; href: string; alert?: boolean }[]
        ).map((k) => (
          <Link key={k.label} href={k.href} className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Card className="h-full p-4 transition-shadow hover:shadow-md">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className={`mt-1 font-serif text-xl font-semibold tabular-nums sm:text-2xl ${k.alert && k.value > 0 ? "text-destructive" : ""}`}>
                {formatBRL(k.value)}
              </p>
              <p className="text-xs text-muted-foreground">{k.hint}</p>
            </Card>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Clientes por situação"
          description="Situação contratual com o escritório"
          data={CONTRACT_STATUSES.map((s) => ({ label: CONTRACT_STATUS_LABELS[s], value: byStatus(s) }))}
        />
        <BarChartCard
          title="Empresas por regime tributário"
          description="CNPJs de clientes (exclui o CNPJ interno)"
          color="var(--chart-2)"
          data={TAX_REGIMES.map((r) => ({ label: TAX_REGIME_LABELS[r], value: summary.companies_by_regime[r] ?? 0 })).filter(
            (d) => d.value > 0,
          )}
        />
      </section>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Clientes cadastrados recentemente</CardTitle>
          <Button asChild variant="link" size="sm">
            <Link href="/clientes">Ver todos</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {summary.recent_clients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <ul className="divide-y">
              {summary.recent_clients.map((c) => (
                <li key={c.company_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link href={`/clientes/${c.company_id}`} className="font-medium hover:text-primary">
                      {c.corporate_name}
                    </Link>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCnpj(c.cnpj)} · desde {formatDate(c.created_at)}
                    </p>
                  </div>
                  <ContractStatusBadge status={c.contract_status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
