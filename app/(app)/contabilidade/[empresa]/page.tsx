import { ArrowDownRight, ArrowUpRight, BookOpen, Landmark, ListTree, Lock, Plus, Scale, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountingNav, ACCOUNTING_TABS, type AccountingTab, PeriodForm } from "@/components/accounting/accounting-nav";
import { AccountsManager } from "@/components/accounting/accounts-manager";
import { ClosingPanel } from "@/components/accounting/closing-panel";
import { EntryActions } from "@/components/accounting/entry-actions";
import { BalanceSheetView, DreView, TrialBalanceTable } from "@/components/accounting/reports";
import { SetupChartButton } from "@/components/accounting/setup-chart";
import { TaxPanel, type TaxFormState } from "@/components/accounting/tax-panel";
import { UrlSelect } from "@/components/dashboard/url-select";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { periodSchema } from "@/schemas/accounting";
import { uuidSchema } from "@/schemas/common";
import {
  ENTRIES_LIMIT,
  getAccountingCompany,
  getLedger,
  getTaxSuggestion,
  getTrialBalance,
  listAccounts,
  listEntries,
  listTaxAssessments,
} from "@/services/accounting";
import { buildBalanceSheet, buildDre } from "@/utils/accounting";
import { formatCnpj } from "@/utils/cnpj";
import { formatISODate, todayISO } from "@/utils/dates";
import { formatBRL, formatMoneyInput } from "@/utils/money";

export const metadata: Metadata = { title: "Contabilidade" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function CompanyAccountingPage({ params, searchParams }: PageProps<"/contabilidade/[empresa]">) {
  const ctx = await requireOrgContext();
  const { empresa } = await params;
  if (!uuidSchema.safeParse(empresa).success) notFound();
  const company = await getAccountingCompany(ctx.organization.id, empresa);
  if (!company) notFound();

  const sp = await searchParams;
  const tab: AccountingTab = ACCOUNTING_TABS.some((t) => t.value === sp.aba) ? (sp.aba as AccountingTab) : "lancamentos";
  const today = todayISO();
  const period = periodSchema.parse({ de: str(sp.de), ate: str(sp.ate) ?? today });
  const q = str(sp.q) ?? "";
  const canWrite = can(ctx.role, "finance:write");
  const base = `/contabilidade/${company.id}`;
  const keep = { de: period.from, ate: period.to };

  const header = (
    <PageHeader
      eyebrow={
        <Link href="/contabilidade" className="hover:text-foreground">
          Contabilidade
        </Link>
      }
      title={company.corporate_name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{formatCnpj(company.cnpj)}</span>
          {company.closed_until && (
            <Badge variant="outline">
              <Lock className="size-3" /> Fechado até {formatISODate(company.closed_until)}
            </Badge>
          )}
        </span>
      }
      actions={
        company.has_chart &&
        canWrite && (
          <Button asChild>
            <Link href={`${base}/lancamentos/novo`}>
              <Plus /> Novo lançamento
            </Link>
          </Button>
        )
      }
    />
  );

  if (!company.has_chart) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={ListTree}
            title="Escrituração ainda não iniciada"
            description={
              canWrite
                ? "Crie o plano de contas padrão (estrutura de Ativo, Passivo, PL, Receitas, Custos e Despesas). Depois você pode incluir, renomear ou inativar contas."
                : "Um contador ou administrador precisa criar o plano de contas desta empresa."
            }
            action={canWrite && <SetupChartButton companyId={company.id} />}
          />
        </Card>
      </>
    );
  }

  const [accounts, trial] = await Promise.all([listAccounts(company.id), getTrialBalance(company.id, period)]);
  const dre = buildDre(trial);
  const dreMap = Object.fromEntries(dre.map((l) => [l.key, l.value]));
  const disponivel = trial.find((r) => r.code === "1.1.1")?.closing ?? 0;
  const gastos = (dreMap.custos ?? 0) + (dreMap.operacionais ?? 0) + (dreMap.financeiras ?? 0) + (dreMap.tributos ?? 0);

  return (
    <>
      {header}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Receita líquida" value={dreMap.liquida ?? 0} format="currency" icon={ArrowUpRight} tone="success" />
        <KpiCard label="Custos e despesas" value={gastos} format="currency" icon={ArrowDownRight} tone="danger" />
        <KpiCard
          label="Resultado do período"
          value={dreMap.liquido ?? 0}
          format="currency"
          icon={TrendingUp}
          tone="dark"
          footer={<span className="text-xs text-sidebar-muted">{(dreMap.liquido ?? 0) >= 0 ? "Lucro" : "Prejuízo"} no período</span>}
        />
        <KpiCard label="Disponibilidades" value={disponivel} format="currency" icon={Landmark} tone="violet" footer={<span className="text-xs text-muted-foreground">Caixa e bancos em {formatISODate(period.to)}</span>} />
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4">
          <AccountingNav base={base} current={tab} keep={keep} />
          {tab !== "plano" && tab !== "fechamento" && tab !== "impostos" && (
            <PeriodForm base={base} tab={tab} from={period.from} to={period.to} extra={tab === "razao" && str(sp.conta) ? { conta: str(sp.conta)! } : undefined} />
          )}
        </div>

        {tab === "lancamentos" && <EntriesTab companyId={company.id} period={period} q={q} canWrite={canWrite} closedUntil={company.closed_until} base={base} />}
        {tab === "plano" && <AccountsManager companyId={company.id} accounts={accounts} canWrite={canWrite} />}
        {tab === "balancete" && <TrialBalanceTable rows={trial} showEmpty={sp.vazias === "1"} />}
        {tab === "dre" && <DreView lines={dre} />}
        {tab === "balanco" && <BalanceSheetView b={buildBalanceSheet(trial)} date={period.to} />}
        {tab === "razao" && (
          <LedgerTab
            companyId={company.id}
            period={period}
            accountId={str(sp.conta)}
            accounts={accounts.filter((a) => a.is_analytic)}
            trial={trial}
          />
        )}
        {tab === "impostos" && (
          <TaxTab
            companyId={company.id}
            regime={company.tax_regime}
            competence={str(sp.competencia)}
            canWrite={canWrite}
            closedUntil={company.closed_until}
          />
        )}
        {tab === "fechamento" && (
          <ClosingPanel
            companyId={company.id}
            closedUntil={company.closed_until}
            suggested={lastDayOfPreviousMonth(today)}
            canClose={canWrite}
            canReopen={can(ctx.role, "members:manage")}
          />
        )}
      </Card>
    </>
  );
}

const centsField = (c: number) => (c ? formatMoneyInput(c / 100) : "");

async function TaxTab({
  companyId,
  regime,
  competence: raw,
  canWrite,
  closedUntil,
}: {
  companyId: string;
  regime: string;
  competence?: string;
  canWrite: boolean;
  closedUntil: string | null;
}) {
  const prev = lastDayOfPreviousMonth(todayISO()).slice(0, 7);
  const competence = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : prev;
  const [s, history] = await Promise.all([getTaxSuggestion(companyId, `${competence}-01`), listTaxAssessments(companyId)]);
  const saved = history.find((h) => h.competence.slice(0, 7) === competence) ?? null;
  const defaultRegime = regime === "lucro_presumido" ? "lucro_presumido" : "simples_nacional";
  const simples = [
    ...(s.salesMonth ? [{ annex: "I" as const, revenue: centsField(s.salesMonth) }] : []),
    ...(s.servicesMonth || !s.salesMonth ? [{ annex: "III" as const, revenue: centsField(s.servicesMonth) }] : []),
  ];
  const presumido = [
    ...(s.salesMonth ? [{ activity: "comercio_industria", revenue: centsField(s.salesMonth), quarter_revenue: centsField(s.salesQuarter) }] : []),
    ...(s.servicesMonth || !s.salesMonth
      ? [{ activity: "servicos", revenue: centsField(s.servicesMonth), quarter_revenue: centsField(s.servicesQuarter) }]
      : []),
  ];
  const suggested: TaxFormState = {
    regime: defaultRegime,
    rbt12: centsField(s.rbt12),
    payroll12: centsField(s.payroll12),
    simples,
    iss_rate: "5",
    presumido,
  };
  // Apuração já salva: reabre com os dados usados nela.
  let initial = suggested;
  if (saved) {
    const inp = saved.inputs as Record<string, unknown>;
    const acts = (inp.activities as Record<string, number | string>[]) ?? [];
    initial =
      saved.regime === "simples_nacional"
        ? {
            ...suggested,
            regime: saved.regime,
            rbt12: centsField(Number(inp.rbt12)),
            payroll12: centsField(Number(inp.payroll12)),
            simples: acts.map((a) => ({ annex: a.annex as TaxFormState["simples"][number]["annex"], revenue: centsField(Number(a.revenue)) })),
          }
        : {
            ...suggested,
            regime: saved.regime,
            iss_rate: String(inp.iss_rate ?? "").replace(".", ","),
            presumido: acts.map((a) => ({
              activity: String(a.activity),
              revenue: centsField(Number(a.revenue)),
              quarter_revenue: centsField(Number(a.quarter_revenue)),
            })),
          };
  }
  const hint =
    regime === "mei"
      ? "Empresa cadastrada como MEI: o DAS-MEI é um valor fixo mensal e não é calculado aqui."
      : regime === "lucro_real"
        ? "Empresa cadastrada no Lucro Real: esta tela apura apenas Simples Nacional e Lucro Presumido."
        : s.monthsWithRevenue > 0 && s.monthsWithRevenue < 12
          ? `A escrituração tem lançamentos em ${s.monthsWithRevenue} dos 12 meses anteriores. Se a empresa está no 1º ano de atividade, o RBT12 deve ser proporcionalizado (média mensal × 12).`
          : null;
  return (
    <TaxPanel
      key={competence}
      companyId={companyId}
      competence={competence}
      initial={initial}
      suggested={suggested}
      saved={saved}
      history={history}
      canWrite={canWrite}
      closedUntil={closedUntil}
      hint={hint}
    />
  );
}

function lastDayOfPreviousMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}

async function EntriesTab({
  companyId,
  period,
  q,
  canWrite,
  closedUntil,
  base,
}: {
  companyId: string;
  period: { from: string; to: string };
  q: string;
  canWrite: boolean;
  closedUntil: string | null;
  base: string;
}) {
  const { entries, truncated } = await listEntries(companyId, period, q);
  return (
    <div>
      <form method="get" action={base} className="border-b border-border p-4">
        <input type="hidden" name="aba" value="lancamentos" />
        <input type="hidden" name="de" value={period.from} />
        <input type="hidden" name="ate" value={period.to} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Pesquisar no histórico ou pelo número…"
          aria-label="Pesquisar lançamentos"
          className="h-9 w-full rounded-lg border border-border-strong bg-card px-3 text-sm sm:max-w-sm"
        />
      </form>
      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum lançamento no período"
          description="Ajuste o período ou registre um novo lançamento."
          action={
            canWrite && (
              <Button asChild size="sm">
                <Link href={`${base}/lancamentos/novo`}>
                  <Plus /> Novo lançamento
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e) => {
            const locked = Boolean(closedUntil && e.entry_date <= closedUntil);
            return (
              <li key={e.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex items-start gap-3">
                  <div className="w-16 shrink-0 sm:w-20">
                    <p className="num font-mono text-[13px] font-medium">nº {e.number}</p>
                    <p className="num text-xs text-muted-foreground">{formatISODate(e.entry_date)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="min-w-0 text-sm font-medium break-words">{e.description}</p>
                      <p className="num text-sm font-semibold whitespace-nowrap">{formatBRL(e.total)}</p>
                    </div>
                    <ul className="mt-1.5 grid gap-0.5 text-[12.5px]">
                      {e.lines.map((l) => (
                        <li key={l.id} className="flex items-baseline gap-2">
                          <span className={l.debit ? "w-4 shrink-0 font-semibold text-info" : "w-4 shrink-0 font-semibold text-warning"}>
                            {l.debit ? "D" : "C"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            <span className="font-mono">{l.account?.code}</span> {l.account?.name}
                            {l.memo && <span className="text-faint"> · {l.memo}</span>}
                          </span>
                          <span className="num whitespace-nowrap">{formatBRL(l.debit || l.credit)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0">
                    {canWrite && !locked ? (
                      <EntryActions companyId={companyId} entryId={e.id} number={e.number} />
                    ) : locked ? (
                      <span title="Período fechado" className="flex size-9 items-center justify-center text-faint">
                        <Lock className="size-4" aria-label="Período fechado" />
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {truncated && (
        <p className="border-t border-border px-4 py-3 text-[13px] text-warning sm:px-5">
          Exibindo os {ENTRIES_LIMIT} lançamentos mais recentes. Reduza o período para ver os demais.
        </p>
      )}
    </div>
  );
}

async function LedgerTab({
  companyId,
  period,
  accountId,
  accounts,
  trial,
}: {
  companyId: string;
  period: { from: string; to: string };
  accountId?: string;
  accounts: Awaited<ReturnType<typeof listAccounts>>;
  trial: Awaited<ReturnType<typeof getTrialBalance>>;
}) {
  const moved = new Set(trial.filter((r) => r.is_analytic && (r.debit || r.credit || r.opening)).map((r) => r.account_id));
  const account = accounts.find((a) => a.id === accountId) ?? accounts.find((a) => moved.has(a.id));
  const options = accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}${moved.has(a.id) ? "" : " (sem movimento)"}` }));
  if (!account) {
    return <EmptyState icon={Scale} title="Sem contas analíticas" />;
  }
  const row = trial.find((r) => r.account_id === account.id);
  const lines = await getLedger(companyId, account, period, row?.opening ?? 0);
  return (
    <div>
      <div className="border-b border-border p-4">
        <UrlSelect param="conta" value={account.id} options={options} label="Conta do razão" className="w-full sm:max-w-md" />
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Razão da conta {account.code}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium sm:px-5">Data</th>
              <th className="px-3 py-2.5 font-medium">Nº</th>
              <th className="px-3 py-2.5 font-medium">Histórico</th>
              <th className="px-3 py-2.5 text-right font-medium">Débito</th>
              <th className="px-3 py-2.5 text-right font-medium">Crédito</th>
              <th className="px-4 py-2.5 text-right font-medium sm:px-5">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/70 bg-subtle/50">
              <td className="px-4 py-2 sm:px-5" colSpan={5}>
                Saldo anterior a {formatISODate(period.from)}
              </td>
              <td className="num px-4 py-2 text-right font-medium sm:px-5">{formatBRL(row?.opening ?? 0)}</td>
            </tr>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-border/70">
                <td className="num px-4 py-2 whitespace-nowrap sm:px-5">{formatISODate(l.entry_date)}</td>
                <td className="num px-3 py-2 font-mono text-[12.5px]">{l.number}</td>
                <td className="px-3 py-2">
                  {l.description}
                  {l.memo && <span className="text-muted-foreground"> · {l.memo}</span>}
                </td>
                <td className="num px-3 py-2 text-right whitespace-nowrap">{l.debit ? formatBRL(l.debit) : ""}</td>
                <td className="num px-3 py-2 text-right whitespace-nowrap">{l.credit ? formatBRL(l.credit) : ""}</td>
                <td className={`num px-4 py-2 text-right whitespace-nowrap sm:px-5 ${l.balance < 0 ? "text-danger" : ""}`}>{formatBRL(l.balance)}</td>
              </tr>
            ))}
            {!lines.length && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                  Sem movimento no período.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="px-4 py-3 sm:px-5" colSpan={3}>
                Saldo em {formatISODate(period.to)}
              </td>
              <td className="num px-3 py-3 text-right">{formatBRL(row?.debit ?? 0)}</td>
              <td className="num px-3 py-3 text-right">{formatBRL(row?.credit ?? 0)}</td>
              <td className="num px-4 py-3 text-right sm:px-5">{formatBRL(row?.closing ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
