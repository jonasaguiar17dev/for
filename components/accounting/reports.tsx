import { cn } from "@/lib/utils";
import type { TrialBalanceRow } from "@/types/database";
import type { BalanceSheet, DreLine } from "@/utils/accounting";
import { formatBRL } from "@/utils/money";

const money = (v: number) => (v === 0 ? "—" : formatBRL(v));
/** Saldo com indicação D/C quando inverte a natureza da conta. */
function balance(v: number, nature: TrialBalanceRow["nature"]) {
  if (v === 0) return "—";
  const side = (v > 0) === (nature === "devedora") ? "D" : "C";
  return `${formatBRL(Math.abs(v))} ${side}`;
}

export function TrialBalanceTable({ rows, showEmpty }: { rows: TrialBalanceRow[]; showEmpty: boolean }) {
  const list = showEmpty ? rows : rows.filter((r) => r.opening || r.debit || r.credit || r.closing);
  const totals = rows
    .filter((r) => r.is_analytic)
    .reduce((a, r) => ({ debit: a.debit + r.debit, credit: a.credit + r.credit }), { debit: 0, credit: 0 });
  const ok = Math.round(totals.debit * 100) === Math.round(totals.credit * 100);
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Balancete de verificação</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium sm:px-5">Conta</th>
            <th className="px-3 py-2.5 text-right font-medium">Saldo anterior</th>
            <th className="px-3 py-2.5 text-right font-medium">Débitos</th>
            <th className="px-3 py-2.5 text-right font-medium">Créditos</th>
            <th className="px-4 py-2.5 text-right font-medium sm:px-5">Saldo atual</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.account_id} className={cn("border-b border-border/70", !r.is_analytic && "bg-subtle/50 font-semibold")}>
              <td className="px-4 py-2 sm:px-5">
                <span className="flex items-baseline gap-3" style={{ paddingLeft: `${Math.min(r.level - 1, 4) * 12}px` }}>
                  <span className="num w-20 shrink-0 font-mono text-[12px] font-normal text-muted-foreground">{r.code}</span>
                  <span className="truncate">{r.name}</span>
                </span>
              </td>
              <td className="num px-3 py-2 text-right whitespace-nowrap">{balance(r.opening, r.nature)}</td>
              <td className="num px-3 py-2 text-right whitespace-nowrap">{money(r.debit)}</td>
              <td className="num px-3 py-2 text-right whitespace-nowrap">{money(r.credit)}</td>
              <td className="num px-4 py-2 text-right whitespace-nowrap sm:px-5">{balance(r.closing, r.nature)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-sm font-semibold">
            <td className="px-4 py-3 sm:px-5">
              Totais do período{" "}
              <span className={cn("ml-2 text-xs font-medium", ok ? "text-success" : "text-danger")}>
                {ok ? "débitos = créditos" : "diferença encontrada"}
              </span>
            </td>
            <td />
            <td className="num px-3 py-3 text-right whitespace-nowrap">{formatBRL(totals.debit)}</td>
            <td className="num px-3 py-3 text-right whitespace-nowrap">{formatBRL(totals.credit)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function DreView({ lines }: { lines: DreLine[] }) {
  const base = lines.find((l) => l.key === "liquida")?.value || 0;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Demonstração do resultado do exercício</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="px-4 py-2.5 font-medium sm:px-5">Descrição</th>
          <th className="px-3 py-2.5 text-right font-medium">Valor</th>
          <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell sm:px-5">% receita líquida</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr
            key={l.key}
            className={cn(
              "border-b border-border/70",
              l.kind === "subtotal" && "bg-subtle/60 font-semibold",
              l.kind === "result" && "bg-brand-graphite text-white",
            )}
          >
            <td className={cn("px-4 py-2.5 sm:px-5", l.kind === "group" && "pl-7 sm:pl-8")}>{l.label}</td>
            <td
              className={cn(
                "num px-3 py-2.5 text-right font-medium whitespace-nowrap",
                l.kind === "result" && "text-base font-semibold",
                l.kind === "result" && l.value < 0 && "text-[#fda4af]",
                l.kind === "subtotal" && l.value < 0 && "text-danger",
              )}
            >
              {l.sign === "-" && l.value ? `(${formatBRL(l.value)})` : formatBRL(l.value)}
            </td>
            <td className={cn("num hidden px-4 py-2.5 text-right sm:table-cell sm:px-5", l.kind === "result" ? "text-white/70" : "text-muted-foreground")}>
              {base ? `${((l.value / base) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Row({ label, value, strong, indent }: { label: string; value: number; strong?: boolean; indent?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-border/70 py-2.5", strong && "font-semibold", indent && "pl-3")}>
      <dt>{label}</dt>
      <dd className={cn("num whitespace-nowrap", value < 0 && "text-danger")}>{formatBRL(value)}</dd>
    </div>
  );
}

export function BalanceSheetView({ b, date }: { b: BalanceSheet; date: string }) {
  return (
    <div className="grid gap-5 p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-4">
          <h3 className="mb-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Ativo</h3>
          <dl className="text-sm">
            <Row label="Ativo circulante" value={b.ativoCirculante} indent />
            <Row label="Ativo não circulante" value={b.ativoNaoCirculante} indent />
          </dl>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-graphite px-3 py-2.5 text-sm font-semibold text-white">
            <span>Total do ativo</span>
            <span className="num">{formatBRL(b.ativo)}</span>
          </div>
        </section>
        <section className="rounded-xl border border-border p-4">
          <h3 className="mb-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Passivo e patrimônio líquido</h3>
          <dl className="text-sm">
            <Row label="Passivo circulante" value={b.passivoCirculante} indent />
            <Row label="Passivo não circulante" value={b.passivoNaoCirculante} indent />
            <Row label="Patrimônio líquido" value={b.patrimonioLiquido} indent />
            <Row label="Resultado do exercício (não encerrado)" value={b.resultadoAcumulado} indent />
          </dl>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-graphite px-3 py-2.5 text-sm font-semibold text-white">
            <span>Total do passivo + PL</span>
            <span className="num">{formatBRL(b.passivoMaisPl)}</span>
          </div>
        </section>
      </div>
      <p className={cn("text-sm", b.diferenca === 0 ? "text-success" : "text-danger")}>
        {b.diferenca === 0
          ? `Balanço fechado em ${date.split("-").reverse().join("/")}: ativo igual a passivo + patrimônio líquido.`
          : `Diferença de ${formatBRL(b.diferenca)} — verifique os lançamentos.`}
      </p>
    </div>
  );
}
