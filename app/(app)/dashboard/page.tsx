import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronRight,
  Building2,
  CircleCheck,
  CirclePause,
  CircleX,
  Clock3,
  FilePlus2,
  LineChart,
  Receipt,
  Repeat,
  Rocket,
  Settings,
  Target,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Ring } from "@/components/charts/ring";
import { TrendChart } from "@/components/charts/trend-chart";
import { Hero } from "@/components/dashboard/hero";
import { Delta, KpiCard, percentChange } from "@/components/dashboard/kpi-card";
import { UrlSelect } from "@/components/dashboard/url-select";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSummary } from "@/services/dashboard";
import { getFinanceSummary } from "@/services/finance";
import type { FinanceMonth } from "@/types/database";
import { formatISODate, monthLabel, todayISO } from "@/utils/dates";
import { formatBRL } from "@/utils/money";
import { receivableState } from "@/utils/receivable-state";

export const metadata: Metadata = { title: "Dashboard" };

const PERIODS = { "6": "6 meses", "12": "12 meses", ano: "No ano" } as const;
type Period = keyof typeof PERIODS;
const MONTHS_LONG = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function PanelHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-primary">
            <Icon className="size-4" />
          </span>
          {title}
        </h3>
        {description && <p className="mt-0.5 pl-[42px] text-[12.5px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function SmallDelta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-[11.5px] text-muted-foreground">sem base anterior</span>;
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : value > 0 !== inverse;
  return (
    <span
      className={cn(
        "num inline-flex w-fit items-center rounded-md px-1.5 py-0.5 text-[11.5px] font-medium",
        good === null && "bg-neutral-soft text-neutral",
        good === true && "bg-success-soft text-success",
        good === false && "bg-danger-soft text-danger",
      )}
    >
      {flat ? "—" : value > 0 ? "↗" : "↘"} {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;
  const period: Period = sp.periodo === "12" || sp.periodo === "ano" ? sp.periodo : "6";
  const [finance, portfolio] = await Promise.all([
    getFinanceSummary(ctx.organization.id, 12),
    getDashboardSummary(ctx.organization.id),
  ]);
  const byStatus = (k: "ativo" | "em_implantacao" | "suspenso" | "encerrado") => portfolio.clients_by_status[k] ?? 0;

  // Nome do usuário para a saudação.
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", ctx.user.id).maybeSingle();
  const firstName = (profile?.full_name || ctx.user.email.split("@")[0]).split(" ")[0];

  const all = finance.received_by_month;
  const year = todayISO().slice(0, 4);
  const shown: FinanceMonth[] = period === "6" ? all.slice(-6) : period === "12" ? all : all.filter((m) => m.month.startsWith(year));
  const last6 = all.slice(-6);
  const now = all.at(-1);
  const prev = all.at(-2);

  // Resumo por competência
  const comps = [...all].reverse();
  const compKey = typeof sp.competencia === "string" && comps.some((m) => m.month === sp.competencia) ? sp.competencia : comps[0]?.month;
  const compIdx = comps.findIndex((m) => m.month === compKey);
  const compNow = comps[compIdx];
  const compPrev = comps[compIdx + 1];

  // Indicadores estratégicos no período escolhido
  const dueTotal = shown.reduce((a, m) => a + m.due_total, 0);
  const duePaid = shown.reduce((a, m) => a + m.due_paid, 0);
  const dueOpen = shown.reduce((a, m) => a + m.due_open, 0);
  const adimplencia = dueTotal ? (duePaid / dueTotal) * 100 : null;
  const inadimplencia = dueTotal ? (dueOpen / dueTotal) * 100 : null;
  const retencao = finance.contracts_total ? (finance.active_contracts / finance.contracts_total) * 100 : null;

  const canFin = can(ctx.role, "finance:write");
  const today = todayISO();
  const quick = [
    canFin
      ? { href: "/financeiro", label: "Nova cobrança", icon: Receipt }
      : { href: "/financeiro", label: "Cobranças", icon: Receipt },
    { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { href: "/clientes", label: "Gerenciar clientes", icon: Users },
    can(ctx.role, "company:create")
      ? { href: "/clientes/novo", label: "Novo cliente", icon: UserPlus }
      : { href: "/empresas", label: "Empresas", icon: Users },
    canFin ? { href: "/contratos/novo", label: "Novo contrato", icon: FilePlus2 } : { href: "/contratos", label: "Contratos", icon: FilePlus2 },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <>
      <Hero firstName={firstName} organizationName={ctx.organization.name} />
      {sp.erro === "permissao" && (
        <Alert variant="destructive" className="mb-4">
          Você não tem permissão para acessar aquela área.
        </Alert>
      )}

      <section aria-label="Indicadores financeiros" className="enter-stagger grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="A receber"
          value={finance.open_total}
          format="currency"
          icon={Wallet}
          tone="dark"
          href="/financeiro?status=a_vencer"
          footer={<span className="text-xs text-sidebar-muted">{finance.open_count} cobrança(s) em aberto</span>}
          spark={last6.map((m) => m.open_end)}
          sparkColor="#FF4D6A"
        />
        <KpiCard
          label="Vencido"
          value={finance.overdue_total}
          format="currency"
          icon={AlertTriangle}
          tone="danger"
          href="/financeiro?status=vencido"
          footer={<Delta value={percentChange(finance.overdue_total, prev?.overdue_end ?? 0)} positiveIsGood={false} label={`${finance.overdue_count} em atraso`} />}
          spark={last6.map((m) => m.overdue_end)}
          sparkColor="#C8102E"
        />
        <KpiCard
          label="Recebido no mês"
          value={now?.received ?? 0}
          format="currency"
          icon={CircleCheck}
          tone="success"
          href="/financeiro?status=pago"
          footer={<Delta value={percentChange(now?.received ?? 0, prev?.received ?? 0)} />}
          spark={last6.map((m) => m.received)}
          sparkColor="#15803D"
        />
        <KpiCard
          label="Receita recorrente"
          value={finance.mrr}
          format="currency"
          icon={Repeat}
          tone="violet"
          href="/contratos?status=ativo"
          footer={<Delta value={percentChange(finance.mrr, prev?.mrr ?? 0)} label={`${finance.active_contracts} contrato(s) ativo(s)`} />}
          spark={last6.map((m) => m.mrr)}
          sparkColor="#7C3AED"
        />
      </section>

      <section aria-label="Carteira de clientes" className="mt-4">
        <Card className="grid grid-cols-2 divide-border overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          {[
            { label: "Empresas cadastradas", value: portfolio.total_companies, icon: Building2, href: "/empresas", cls: "bg-brand-graphite text-white" },
            { label: "Clientes ativos", value: byStatus("ativo"), icon: CircleCheck, href: "/clientes?status=ativo", cls: "bg-success-soft text-success" },
            { label: "Em implantação", value: byStatus("em_implantacao"), icon: Rocket, href: "/clientes?status=em_implantacao", cls: "bg-info-soft text-info" },
            { label: "Suspensos", value: byStatus("suspenso"), icon: CirclePause, href: "/clientes?status=suspenso", cls: "bg-warning-soft text-warning" },
            { label: "Encerrados", value: byStatus("encerrado"), icon: CircleX, href: "/clientes?status=encerrado", cls: "bg-neutral-soft text-neutral" },
          ].map((i, idx) => (
            <Link
              key={i.label}
              href={i.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle/70",
                idx === 0 && "col-span-2 sm:col-span-1",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", i.cls)}>
                <i.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="num block text-xl leading-tight font-semibold">{i.value.toLocaleString("pt-BR")}</span>
                <span className="block truncate text-xs text-muted-foreground">{i.label}</span>
              </span>
            </Link>
          ))}
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
        <Card className="rounded-2xl">
          <PanelHeader
            icon={LineChart}
            title="Faturado e recebido"
            description={`${PERIODS[period]} · faturado por competência e recebido pela data do pagamento`}
            action={
              <nav aria-label="Período" className="inline-flex gap-0.5 rounded-xl border border-border bg-subtle p-1">
                {(Object.keys(PERIODS) as Period[]).map((p) => (
                  <Link
                    key={p}
                    href={`/dashboard?periodo=${p}${compKey ? `&competencia=${compKey}` : ""}`}
                    scroll={false}
                    aria-current={p === period ? "true" : undefined}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors",
                      p === period ? "bg-primary text-white shadow-[0_4px_10px_-4px_rgb(200_16_46/0.6)]" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {PERIODS[p]}
                  </Link>
                ))}
              </nav>
            }
          />
          <div className="p-5">
            <TrendChart
              caption="Faturado e recebido por mês"
              currency
              variant="bar"
              height={240}
              xKey="mes"
              data={shown.map((m) => ({ mes: monthLabel(m.month), faturado: m.billed, recebido: m.received }))}
              series={[
                { key: "faturado", label: "Faturado", color: "var(--chart-1)" },
                { key: "recebido", label: "Recebido", color: "var(--chart-2)" },
              ]}
            />
          </div>
        </Card>
        <Card className="rounded-2xl">
          <PanelHeader icon={Zap} title="Ações rápidas" description="Atalhos para as tarefas mais comuns" />
          <div className="grid grid-cols-2 gap-2.5 p-5">
            {quick.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-2.5 text-center text-[13px] font-medium transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-md"
              >
                <q.icon className="size-5 text-primary" />
                {q.label}
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-2xl">
          <PanelHeader
            icon={Wallet}
            title="Resumo financeiro"
            description="Cobranças da competência"
            action={
              compKey && (
                <div className="w-32">
                <UrlSelect
                  param="competencia"
                  label="Competência"
                  value={compKey}
                  className="h-8 text-[13px]"
                  options={comps.map((m) => ({ value: m.month, label: `${MONTHS_LONG[Number(m.month.slice(5, 7)) - 1]}/${m.month.slice(0, 4)}` }))}
                />
                </div>
              )
            }
          />
          <div className="grid grid-cols-1 gap-4 p-5 min-[420px]:grid-cols-3">
            {[
              { label: "Recebido", value: compNow?.comp_paid ?? 0, prev: compPrev?.comp_paid ?? 0, icon: CircleCheck, cls: "bg-success-soft text-success", inverse: false },
              { label: "Pendente", value: compNow?.comp_open ?? 0, prev: compPrev?.comp_open ?? 0, icon: Clock3, cls: "bg-warning-soft text-warning", inverse: true },
              { label: "Total faturado", value: compNow?.billed ?? 0, prev: compPrev?.billed ?? 0, icon: Receipt, cls: "bg-subtle text-foreground", inverse: false },
            ].map((i) => (
              <div key={i.label} className="grid min-w-0 gap-1">
                <span className={cn("flex size-7 items-center justify-center rounded-lg", i.cls)}>
                  <i.icon className="size-3.5" />
                </span>
                <span className="text-xs text-muted-foreground">{i.label}</span>
                <span className="num truncate text-base font-semibold">{formatBRL(i.value)}</span>
                <SmallDelta value={percentChange(i.value, i.prev)} inverse={i.inverse} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl">
          <PanelHeader
            icon={CalendarClock}
            title="Próximos vencimentos"
            description="Cobranças em aberto"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/financeiro?status=a_vencer">
                  Ver todos <ChevronRight />
                </Link>
              </Button>
            }
          />
          <div className="px-5 pt-2 pb-4">
            {finance.upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nenhum vencimento à frente" description="Cobranças em aberto aparecem aqui." className="py-8" />
            ) : (
              <ul className="grid">
                {finance.upcoming.slice(0, 5).map((r) => {
                  const soon = receivableState("aberto", r.due_date, today) === "pendente";
                  return (
                    <li key={r.id} className="border-t border-border first:border-0">
                      <Link
                        href={`/clientes/${r.company_id}`}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2.5 text-[13px] hover:bg-subtle"
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", soon ? "bg-warning" : "bg-faint")} />
                          <span className="num text-muted-foreground">{formatISODate(r.due_date).slice(0, 5)}</span>
                        </span>
                        <span className="truncate">{r.corporate_name}</span>
                        <span className="num font-semibold">{formatBRL(r.amount)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card className="rounded-2xl lg:col-span-2 xl:col-span-1">
          <PanelHeader icon={Target} title="Indicadores estratégicos" description={`${PERIODS[period]} · vencimentos até hoje`} />
          <div className="grid grid-cols-3 gap-2 p-5">
            <Ring value={adimplencia} color="var(--success)" label="Adimplência" hint="vencido e recebido" title="Valor recebido ÷ valor que venceu no período" />
            <Ring value={inadimplencia} color="var(--primary)" label="Inadimplência" hint="vencido em aberto" title="Valor vencido e ainda em aberto ÷ valor que venceu no período" />
            <Ring value={retencao} color="var(--success)" label="Retenção" hint="contratos ativos" title="Contratos ativos ÷ contratos ativos, suspensos e encerrados" />
          </div>
        </Card>
      </section>
    </>
  );
}
