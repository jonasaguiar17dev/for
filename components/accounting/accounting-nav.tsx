import Link from "next/link";

import { cn } from "@/lib/utils";

export const ACCOUNTING_TABS = [
  { value: "lancamentos", label: "Lançamentos" },
  { value: "plano", label: "Plano de contas" },
  { value: "balancete", label: "Balancete" },
  { value: "dre", label: "DRE" },
  { value: "balanco", label: "Balanço" },
  { value: "razao", label: "Razão" },
  { value: "impostos", label: "Impostos" },
  { value: "fechamento", label: "Fechamento" },
] as const;
export type AccountingTab = (typeof ACCOUNTING_TABS)[number]["value"];

export function AccountingNav({ base, current, keep }: { base: string; current: AccountingTab; keep: Record<string, string> }) {
  return (
    <nav aria-label="Seções da contabilidade" className="scroll-thin -mb-px flex gap-1 overflow-x-auto">
      {ACCOUNTING_TABS.map((t) => {
        const p = new URLSearchParams({ ...keep, aba: t.value });
        const active = t.value === current;
        return (
          <Link
            key={t.value}
            href={`${base}?${p}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              active ? "bg-brand-graphite text-white shadow-sm" : "text-muted-foreground hover:bg-subtle hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Filtro de período por GET (funciona sem JavaScript). */
export function PeriodForm({ base, tab, from, to, extra }: { base: string; tab: string; from: string; to: string; extra?: Record<string, string> }) {
  const year = to.slice(0, 4);
  const month = to.slice(0, 7);
  const lastDay = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  };
  const presets = [
    { label: "Mês", de: `${month}-01`, ate: lastDay(month) },
    { label: "Ano", de: `${year}-01-01`, ate: `${year}-12-31` },
    { label: `${Number(year) - 1}`, de: `${Number(year) - 1}-01-01`, ate: `${Number(year) - 1}-12-31` },
  ];
  return (
    <div className="flex flex-wrap items-end gap-2">
      <form action={base} method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="aba" value={tab} />
        {Object.entries(extra ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="grid gap-1 text-xs text-muted-foreground">
          De
          <input type="date" name="de" defaultValue={from} className="h-9 rounded-lg border border-border-strong bg-card px-2.5 text-sm text-foreground" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Até
          <input type="date" name="ate" defaultValue={to} className="h-9 rounded-lg border border-border-strong bg-card px-2.5 text-sm text-foreground" />
        </label>
        <button type="submit" className="h-9 rounded-lg bg-brand-graphite px-3 text-[13px] font-medium text-white hover:bg-[#2a2622]">
          Aplicar
        </button>
      </form>
      <div className="flex gap-1">
        {presets.map((p) => {
          const active = p.de === from && p.ate === to;
          const qs = new URLSearchParams({ ...(extra ?? {}), aba: tab, de: p.de, ate: p.ate });
          return (
            <Link
              key={p.label}
              href={`${base}?${qs}`}
              className={cn(
                "inline-flex h-9 items-center rounded-lg border px-2.5 text-[13px] font-medium",
                active ? "border-primary/30 bg-danger-soft text-primary" : "border-border text-muted-foreground hover:bg-subtle",
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
