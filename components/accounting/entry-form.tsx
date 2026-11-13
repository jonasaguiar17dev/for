"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Plus, Save, Scale, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type Path, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { saveEntry } from "@/app/(app)/contabilidade/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { type JournalEntryInput, type JournalEntryValues, journalEntrySchema } from "@/schemas/accounting";
import type { AccountRow } from "@/types/database";
import { formatISODate } from "@/utils/dates";
import { formatBRL, parseMoneyToCents } from "@/utils/money";

const EMPTY_LINE = { account_id: "", debit: "", credit: "", memo: "" };

export function EntryForm({
  companyId,
  entryId,
  accounts,
  defaultValues,
  closedUntil,
}: {
  companyId: string;
  entryId: string | null;
  accounts: Pick<AccountRow, "id" | "code" | "name" | "type">[];
  defaultValues: JournalEntryInput;
  closedUntil: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<JournalEntryInput, unknown, JournalEntryValues>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues,
    mode: "onTouched",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines", keyName: "key" });
  const lines = useWatch({ control: form.control, name: "lines" }) ?? [];
  const date = useWatch({ control: form.control, name: "entry_date" });
  const errors = form.formState.errors;

  const cents = (v: unknown) => parseMoneyToCents(String(v ?? "")) ?? 0;
  const debit = lines.reduce((a, l) => a + cents(l?.debit), 0);
  const credit = lines.reduce((a, l) => a + cents(l?.credit), 0);
  const diff = debit - credit;
  const balanced = debit > 0 && diff === 0;
  const locked = Boolean(closedUntil && date && String(date) <= closedUntil);

  /** Completa a última partida com a diferença, no lado que falta. */
  function fillDifference(index: number) {
    if (!diff) return;
    const own = cents(lines[index]?.debit) - cents(lines[index]?.credit);
    const target = own - diff; // valor que zera a diferença
    form.setValue(`lines.${index}.debit`, target > 0 ? (target / 100).toFixed(2).replace(".", ",") : "", { shouldValidate: true });
    form.setValue(`lines.${index}.credit`, target < 0 ? (-target / 100).toFixed(2).replace(".", ",") : "", { shouldValidate: true });
  }

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await saveEntry(companyId, entryId, values);
      if (!result.ok) {
        setError(result.error);
        for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(path as Path<JournalEntryInput>, { message: messages[0] });
        }
        return;
      }
      toast.success(result.message ?? "Salvo.");
      router.push(`/contabilidade/${companyId}?aba=lancamentos`);
      router.refresh();
    });
  });

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      {locked && (
        <Alert variant="warning">
          A escrituração está fechada até {formatISODate(closedUntil)}. Escolha uma data posterior ou peça a reabertura do período.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados do lançamento</CardTitle>
          <CardDescription>O número é gerado automaticamente, em sequência por empresa.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-[200px_1fr]">
          <FormField id="entry_date" label="Data" required error={errors.entry_date?.message}>
            <Input type="date" disabled={pending} {...form.register("entry_date")} />
          </FormField>
          <FormField id="description" label="Histórico" required error={errors.description?.message}>
            <Input disabled={pending} maxLength={300} placeholder="Ex.: Pagamento do aluguel de março" {...form.register("description")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partidas</CardTitle>
          <CardDescription>Cada partida tem débito ou crédito. A soma dos débitos precisa ser igual à dos créditos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {linesError && <p className="text-sm font-medium text-danger">{linesError}</p>}
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-3 px-1 text-xs font-medium text-muted-foreground lg:grid">
            <span>Conta</span>
            <span>Débito (R$)</span>
            <span>Crédito (R$)</span>
            <span>Complemento</span>
            <span className="w-9" />
          </div>
          {fields.map((field, index) => {
            const e = errors.lines?.[index];
            const label = (s: string) => `${s} — partida ${index + 1}`;
            return (
              <div
                key={field.key}
                className="grid gap-3 rounded-xl border border-border bg-background/40 p-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] lg:items-start lg:border-0 lg:bg-transparent lg:p-0"
              >
                <div className="grid gap-1">
                  <NativeSelect aria-label={label("Conta")} aria-invalid={Boolean(e?.account_id)} disabled={pending} {...form.register(`lines.${index}.account_id`)}>
                    <option value="">Selecione a conta…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                  {e?.account_id?.message && <p className="text-xs font-medium text-danger">{e.account_id.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3 lg:contents">
                  <div className="grid gap-1">
                    <Input
                      aria-label={label("Débito")}
                      inputMode="decimal"
                      placeholder="Débito"
                      className="num text-right"
                      aria-invalid={Boolean(e?.debit)}
                      disabled={pending}
                      {...form.register(`lines.${index}.debit`)}
                    />
                    {e?.debit?.message && <p className="text-xs font-medium text-danger">{e.debit.message}</p>}
                  </div>
                  <Input
                    aria-label={label("Crédito")}
                    inputMode="decimal"
                    placeholder="Crédito"
                    className="num text-right"
                    disabled={pending}
                    {...form.register(`lines.${index}.credit`)}
                  />
                </div>
                <div className="flex gap-2">
                  <Input aria-label={label("Complemento")} placeholder="Complemento (opcional)" disabled={pending} maxLength={200} {...form.register(`lines.${index}.memo`)} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending || fields.length <= 2}
                    onClick={() => remove(index)}
                    aria-label={`Remover partida ${index + 1}`}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pending || fields.length >= 60} onClick={() => append(EMPTY_LINE)}>
              <Plus /> Adicionar partida
            </Button>
            {diff !== 0 && debit + credit > 0 && (
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => fillDifference(fields.length - 1)}>
                <Scale /> Completar a última partida com a diferença
              </Button>
            )}
          </div>

          <dl
            className={cn(
              "mt-2 grid grid-cols-3 gap-3 rounded-xl border p-3 text-sm sm:p-4",
              balanced ? "border-success/25 bg-success-soft" : "border-border bg-subtle/60",
            )}
            aria-live="polite"
          >
            <div>
              <dt className="text-xs text-muted-foreground">Débitos</dt>
              <dd className="num text-base font-semibold sm:text-lg">{formatBRL(debit / 100)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Créditos</dt>
              <dd className="num text-base font-semibold sm:text-lg">{formatBRL(credit / 100)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Diferença</dt>
              <dd className={cn("num flex items-center gap-1.5 text-base font-semibold sm:text-lg", balanced ? "text-success" : diff ? "text-danger" : "")}>
                {balanced && <CheckCircle2 className="size-4" aria-hidden />}
                {balanced ? "Fechado" : formatBRL(Math.abs(diff) / 100)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || locked}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Salvar lançamento
        </Button>
      </div>
    </form>
  );
}
