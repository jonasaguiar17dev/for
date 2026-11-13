"use client";

import { AlertTriangle, BookCheck, Calculator, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTaxAssessment, saveTaxAssessment } from "@/app/(app)/contabilidade/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { taxFormSchema } from "@/schemas/taxes";
import { formatISODate } from "@/utils/dates";
import { formatBRL } from "@/utils/money";
import {
  dasDueDate,
  PRESUMIDO_ACTIVITIES,
  PRESUMIDO_ACTIVITY_KEYS,
  runTaxCalc,
  SIMPLES_ANNEX_LABELS,
  SIMPLES_ANNEXES,
  type SimplesAnnex,
} from "@/utils/taxes";

type Regime = "simples_nacional" | "lucro_presumido";
type SimplesLine = { annex: SimplesAnnex; revenue: string };
type PresumidoLine = { activity: string; revenue: string; quarter_revenue: string };
export type TaxFormState = {
  regime: Regime;
  rbt12: string;
  payroll12: string;
  simples: SimplesLine[];
  iss_rate: string;
  presumido: PresumidoLine[];
};
export type TaxHistoryItem = {
  id: string;
  competence: string;
  regime: Regime;
  total: number;
  due_date: string | null;
  entry_id: string | null;
  entry_number: number | null;
  updated_at: string;
};

const money = (c: number) => formatBRL(c / 100);
const pct = (v: number, d = 2) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: 4 })}%`;
const TAX_LABEL: Record<string, string> = { CPP: "CPP (INSS patronal)" };

export function TaxPanel({
  companyId,
  competence,
  initial,
  suggested,
  saved,
  history,
  canWrite,
  closedUntil,
  hint,
}: {
  companyId: string;
  competence: string; // AAAA-MM
  initial: TaxFormState;
  suggested: TaxFormState;
  saved: TaxHistoryItem | null;
  history: TaxHistoryItem[];
  canWrite: boolean;
  closedUntil: string | null;
  hint: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [form, setForm] = useState<TaxFormState>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(
    () =>
      form.regime === "simples_nacional"
        ? { regime: form.regime, competence, rbt12: form.rbt12, payroll12: form.payroll12, activities: form.simples }
        : { regime: form.regime, competence, iss_rate: form.iss_rate, activities: form.presumido },
    [form, competence],
  );
  const calc = useMemo(() => {
    const p = taxFormSchema.safeParse(payload);
    if (!p.success) return { ok: false as const, error: "Verifique os valores informados." };
    return runTaxCalc(p.data as Parameters<typeof runTaxCalc>[0]);
  }, [payload]);

  const set = <K extends keyof TaxFormState>(k: K, v: TaxFormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const lastDay = new Date(Date.UTC(Number(competence.slice(0, 4)), Number(competence.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const locked = Boolean(closedUntil && lastDay <= closedUntil);
  const quarterEnd = [3, 6, 9, 12].includes(Number(competence.slice(5, 7)));

  const goCompetence = (v: string) => {
    if (!/^\d{4}-\d{2}$/.test(v)) return;
    const p = new URLSearchParams(params.toString());
    p.set("aba", "impostos");
    p.set("competencia", v);
    router.replace(`${pathname}?${p}`, { scroll: false });
  };

  const submit = (post: boolean) => {
    setError(null);
    startTransition(async () => {
      const r = await saveTaxAssessment(companyId, payload, post);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(r.message ?? "Salvo.");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Entrada */}
      <div className="grid content-start gap-5 border-b border-border p-4 sm:p-5 lg:border-r lg:border-b-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="tax-competence" label="Competência">
            <Input type="month" defaultValue={competence} onChange={(e) => goCompetence(e.target.value)} />
          </FormField>
          <FormField id="tax-regime" label="Regime de apuração">
            <NativeSelect value={form.regime} onChange={(e) => set("regime", e.target.value as Regime)} disabled={pending}>
              <option value="simples_nacional">Simples Nacional (DAS)</option>
              <option value="lucro_presumido">Lucro Presumido</option>
            </NativeSelect>
          </FormField>
        </div>
        {hint && <Alert variant="info">{hint}</Alert>}

        {form.regime === "simples_nacional" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="tax-rbt12" label="RBT12 — receita bruta dos 12 meses anteriores (R$)" hint="Sugerido pela escrituração (contas 3.1). Em branco ou zero no 1º mês: proporcional.">
                <Input inputMode="decimal" className="num text-right" value={form.rbt12} onChange={(e) => set("rbt12", e.target.value)} disabled={pending} />
              </FormField>
              <FormField id="tax-payroll" label="Folha dos 12 meses (R$) — Fator R" hint="Salários, pró-labore, 13º, INSS patronal e FGTS. Usado só no Anexo III/V.">
                <Input inputMode="decimal" className="num text-right" value={form.payroll12} onChange={(e) => set("payroll12", e.target.value)} disabled={pending} />
              </FormField>
            </div>
            <div className="grid gap-2">
              <p className="text-[13px] font-medium">Receita do mês por atividade</p>
              {form.simples.map((l, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_140px_auto] gap-2">
                  <NativeSelect
                    aria-label={`Anexo da atividade ${i + 1}`}
                    value={l.annex}
                    disabled={pending}
                    onChange={(e) => set("simples", form.simples.map((x, j) => (j === i ? { ...x, annex: e.target.value as SimplesAnnex } : x)))}
                  >
                    {SIMPLES_ANNEXES.map((a) => (
                      <option key={a} value={a}>
                        {SIMPLES_ANNEX_LABELS[a]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input
                    aria-label={`Receita da atividade ${i + 1}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="num text-right"
                    value={l.revenue}
                    disabled={pending}
                    onChange={(e) => set("simples", form.simples.map((x, j) => (j === i ? { ...x, revenue: e.target.value } : x)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover atividade ${i + 1}`}
                    disabled={pending || form.simples.length === 1}
                    onClick={() => set("simples", form.simples.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={pending || form.simples.length >= 8} onClick={() => set("simples", [...form.simples, { annex: "III", revenue: "" }])}>
                <Plus /> Adicionar atividade
              </Button>
            </div>
          </>
        ) : (
          <>
            <FormField id="tax-iss" label="Alíquota do ISS (%)" hint="Definida pelo município (2% a 5%). Incide só sobre serviços.">
              <Input inputMode="decimal" className="num w-32 text-right" value={form.iss_rate} onChange={(e) => set("iss_rate", e.target.value)} disabled={pending} />
            </FormField>
            <div className="grid gap-2">
              <div className="hidden grid-cols-[minmax(0,1fr)_130px_130px_auto] gap-2 text-xs font-medium text-muted-foreground sm:grid">
                <span>Atividade</span>
                <span className="text-right">Receita do mês</span>
                <span className="text-right">{quarterEnd ? "Receita do trimestre" : "Trimestre (só em mar/jun/set/dez)"}</span>
                <span className="w-9" />
              </div>
              {form.presumido.map((l, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_130px_130px_auto]">
                  <NativeSelect
                    className="col-span-2 sm:col-span-1"
                    aria-label={`Atividade ${i + 1}`}
                    value={l.activity}
                    disabled={pending}
                    onChange={(e) => set("presumido", form.presumido.map((x, j) => (j === i ? { ...x, activity: e.target.value } : x)))}
                  >
                    {PRESUMIDO_ACTIVITY_KEYS.map((a) => (
                      <option key={a} value={a}>
                        {PRESUMIDO_ACTIVITIES[a].label} — IRPJ {PRESUMIDO_ACTIVITIES[a].irpj}% / CSLL {PRESUMIDO_ACTIVITIES[a].csll}%
                      </option>
                    ))}
                  </NativeSelect>
                  <Input
                    aria-label={`Receita do mês da atividade ${i + 1}`}
                    inputMode="decimal"
                    placeholder="Mês"
                    className="num text-right"
                    value={l.revenue}
                    disabled={pending}
                    onChange={(e) => set("presumido", form.presumido.map((x, j) => (j === i ? { ...x, revenue: e.target.value } : x)))}
                  />
                  <Input
                    aria-label={`Receita do trimestre da atividade ${i + 1}`}
                    inputMode="decimal"
                    placeholder="Trimestre"
                    className="num text-right"
                    value={l.quarter_revenue}
                    disabled={pending || !quarterEnd}
                    onChange={(e) => set("presumido", form.presumido.map((x, j) => (j === i ? { ...x, quarter_revenue: e.target.value } : x)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover atividade ${i + 1}`}
                    disabled={pending || form.presumido.length === 1}
                    onClick={() => set("presumido", form.presumido.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                disabled={pending || form.presumido.length >= 8}
                onClick={() => set("presumido", [...form.presumido, { activity: "servicos", revenue: "", quarter_revenue: "" }])}
              >
                <Plus /> Adicionar atividade
              </Button>
            </div>
          </>
        )}
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" disabled={pending} onClick={() => setForm({ ...suggested, regime: form.regime })}>
          <RotateCcw /> Recarregar valores da escrituração
        </Button>
      </div>

      {/* Resultado */}
      <div className="grid content-start gap-4 p-4 sm:p-5">
        {error && <Alert variant="destructive">{error}</Alert>}
        {!calc.ok ? (
          <Alert variant="warning">
            <AlertTriangle /> {calc.error}
          </Alert>
        ) : (
          <>
            <div className="rounded-2xl bg-brand-graphite p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-[13px] text-white/70">
                <Calculator className="size-4" />
                {calc.regime === "simples_nacional" ? "DAS a recolher" : "Tributos da competência"} · {competence.slice(5, 7)}/{competence.slice(0, 4)}
              </p>
              <p className="num mt-1 text-[30px] leading-tight font-semibold tracking-tight">{money(calc.total)}</p>
              {calc.regime === "simples_nacional" && (
                <p className="mt-1 text-[13px] text-white/70">Vencimento: {formatISODate(dasDueDate(`${competence}-01`))}</p>
              )}
            </div>

            {calc.regime === "simples_nacional" && (
              <div className="grid gap-2 text-sm">
                <p className="text-[13px] text-muted-foreground">
                  RBT12 considerado: <strong className="num text-foreground">{money(calc.rbt12Used)}</strong>
                  {calc.fatorR !== null && (
                    <>
                      {" "}
                      · Fator R: <strong className="num text-foreground">{pct(calc.fatorR * 100, 1)}</strong>
                    </>
                  )}
                </p>
                {calc.activities.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg border border-border px-3 py-2">
                    <span>
                      Anexo {a.appliedAnnex} · {a.faixa}ª faixa{" "}
                      <span className="text-muted-foreground">
                        (nominal {pct(a.nominalRate, 1)} → efetiva <strong className="text-foreground">{pct(a.effectiveRate)}</strong>)
                      </span>
                    </span>
                    <span className="num font-medium">
                      {money(a.revenue)} → {money(a.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {calc.regime === "lucro_presumido" && calc.quarterEnd && (
              <p className="text-[13px] text-muted-foreground">
                Base presumida do trimestre — IRPJ: <strong className="num text-foreground">{money(calc.irpjBase)}</strong> · CSLL:{" "}
                <strong className="num text-foreground">{money(calc.csllBase)}</strong>
              </p>
            )}

            <table className="w-full text-sm">
              <caption className="sr-only">Valor por tributo</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Tributo</th>
                  <th className="py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {calc.taxes.map((t) => (
                  <tr key={t.tax} className="border-b border-border/70">
                    <td className="py-2">{TAX_LABEL[t.tax] ?? t.tax}</td>
                    <td className="num py-2 text-right">{money(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {calc.warnings.length > 0 && (
              <ul className="grid gap-1 text-[12.5px] text-muted-foreground">
                {calc.warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            )}
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={pending} onClick={() => submit(false)}>
                  {pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar apuração
                </Button>
                <Button disabled={pending || locked} onClick={() => submit(true)}>
                  {pending ? <Loader2 className="animate-spin" /> : <BookCheck />} {saved?.entry_id ? "Salvar e atualizar lançamento" : "Salvar e contabilizar"}
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">Seu papel permite apenas consultar as apurações.</p>
            )}
            {locked && <p className="text-[13px] text-warning">Competência em período fechado: não é possível contabilizar.</p>}
            {saved && (
              <p className="text-[12.5px] text-muted-foreground">
                Apuração salva em {new Date(saved.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                {saved.entry_number ? ` · lançamento nº ${saved.entry_number}` : " · ainda não contabilizada"}.
              </p>
            )}
          </>
        )}
      </div>

      {/* Histórico */}
      <div className="border-t border-border lg:col-span-2">
        <p className="px-4 pt-4 text-[13px] font-semibold sm:px-5">Apurações salvas</p>
        {history.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">Nenhuma apuração salva para esta empresa.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5", h.competence.slice(0, 7) === competence && "bg-subtle/60")}>
                <Link
                  href={`${pathname}?${new URLSearchParams({ aba: "impostos", competencia: h.competence.slice(0, 7) })}`}
                  className="num w-20 font-mono text-[13px] font-medium hover:text-primary"
                >
                  {h.competence.slice(5, 7)}/{h.competence.slice(0, 4)}
                </Link>
                <span className="min-w-0 flex-1 text-sm">
                  {h.regime === "simples_nacional" ? "DAS — Simples Nacional" : "Lucro Presumido"}
                  {h.due_date && <span className="text-muted-foreground"> · vence {formatISODate(h.due_date)}</span>}
                </span>
                {h.entry_number ? <Badge variant="success">Lançamento nº {h.entry_number}</Badge> : <Badge variant="neutral">Não contabilizada</Badge>}
                <span className="num w-28 text-right text-sm font-semibold">{formatBRL(h.total)}</span>
                {canWrite && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Excluir apuração ${h.competence.slice(5, 7)}/${h.competence.slice(0, 4)}`}
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(h.entry_id ? "Excluir a apuração e o lançamento contábil gerado?" : "Excluir a apuração?")) return;
                      startTransition(async () => {
                        const r = await deleteTaxAssessment(companyId, h.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success(r.message ?? "Excluída.");
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
