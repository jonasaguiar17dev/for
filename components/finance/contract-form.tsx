"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type Path, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { saveContract } from "@/app/(app)/contratos/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type ContractFormInput, type ContractFormValues, contractFormSchema } from "@/schemas/finance";
import type { ServiceRow } from "@/types/database";
import {
  ADJUSTMENT_INDEX_LABELS,
  ADJUSTMENT_INDEXES,
  BILLING_FREQUENCIES,
  BILLING_FREQUENCY_LABELS,
  CONTRACT_STATE_LABELS,
  CONTRACT_STATES,
  MONTH_LABELS,
} from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatBRL, formatMoneyInput, parseMoneyToCents } from "@/utils/money";

type ClientOption = { id: string; corporate_name: string; cnpj: string };

const FACTOR = { mensal: 12, trimestral: 4, semestral: 2, anual: 1, avulso: 0 } as const;

export function ContractForm({
  contractId,
  defaultValues,
  clients,
  services,
}: {
  contractId: string | null;
  defaultValues: ContractFormInput;
  clients: ClientOption[];
  services: ServiceRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ContractFormInput, unknown, ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items", keyName: "key" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const adjustment = useWatch({ control: form.control, name: "adjustment_index" });
  const errors = form.formState.errors;

  const lineTotal = (i: (typeof items)[number]) => {
    const q = Number(String(i?.quantity ?? "").replace(",", "."));
    const cents = parseMoneyToCents(String(i?.unit_amount ?? ""));
    return Number.isFinite(q) && cents !== null ? Math.round(q * cents) : 0;
  };
  const monthly = items.filter((i) => i?.billing_frequency === "mensal").reduce((a, i) => a + lineTotal(i), 0) / 100;
  const yearly =
    items.reduce((a, i) => a + lineTotal(i) * (FACTOR[(i?.billing_frequency ?? "mensal") as keyof typeof FACTOR] || 0), 0) / 100 +
    items.filter((i) => i?.billing_frequency === "avulso").reduce((a, i) => a + lineTotal(i), 0) / 100;

  function pickService(index: number, serviceId: string) {
    const s = services.find((x) => x.id === serviceId);
    form.setValue(`items.${index}.service_id`, serviceId);
    if (!s) return;
    form.setValue(`items.${index}.description`, s.name, { shouldValidate: true });
    form.setValue(`items.${index}.unit_amount`, formatMoneyInput(s.default_amount), { shouldValidate: true });
    form.setValue(`items.${index}.billing_frequency`, s.billing_frequency);
  }

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await saveContract(contractId, values);
      if (!result.ok) {
        setError(result.error);
        for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(path as Path<ContractFormInput>, { message: messages[0] });
        }
        return;
      }
      toast.success(result.message ?? "Salvo.");
      router.push(`/contratos/${result.data.id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Dados do contrato</CardTitle>
          <CardDescription>Cliente, vigência e regras de cobrança.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
            <FormField id="company_id" label="Cliente" required error={errors.company_id?.message}>
              <NativeSelect disabled={pending || contractId !== null} {...form.register("company_id")}>
                <option value="">Selecione…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.corporate_name} — {formatCnpj(c.cnpj)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="status" label="Situação" error={errors.status?.message}>
              <NativeSelect disabled={pending} {...form.register("status")}>
                {CONTRACT_STATES.map((s) => (
                  <option key={s} value={s}>
                    {CONTRACT_STATE_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FormField id="start_date" label="Início da vigência" required error={errors.start_date?.message}>
              <Input type="date" disabled={pending} {...form.register("start_date")} />
            </FormField>
            <FormField id="end_date" label="Término (opcional)" error={errors.end_date?.message} hint="Em branco = prazo indeterminado.">
              <Input type="date" disabled={pending} {...form.register("end_date")} />
            </FormField>
            <FormField id="billing_day" label="Dia de vencimento" required error={errors.billing_day?.message} hint="De 1 a 28.">
              <Input type="number" min={1} max={28} inputMode="numeric" disabled={pending} {...form.register("billing_day")} />
            </FormField>
            <FormField id="adjustment_index" label="Índice de reajuste" error={errors.adjustment_index?.message}>
              <NativeSelect disabled={pending} {...form.register("adjustment_index")}>
                {ADJUSTMENT_INDEXES.map((s) => (
                  <option key={s} value={s}>
                    {ADJUSTMENT_INDEX_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {adjustment !== "nenhum" && (
              <FormField id="adjustment_month" label="Mês do reajuste" required error={errors.adjustment_month?.message}>
                <NativeSelect disabled={pending} {...form.register("adjustment_month")}>
                  <option value="">Selecione…</option>
                  {MONTH_LABELS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}
          </div>
          <FormField id="notes" label="Observações" error={errors.notes?.message}>
            <Textarea disabled={pending} maxLength={2000} {...form.register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Serviços e honorários</CardTitle>
          <CardDescription>Cada item é cobrado conforme a periodicidade, a partir do mês de início.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {errors.items?.root?.message || errors.items?.message ? (
            <p className="text-sm font-medium text-destructive">{errors.items?.root?.message ?? errors.items?.message}</p>
          ) : null}
          {fields.map((field, index) => {
            const e = errors.items?.[index];
            return (
              <div key={field.key} className="grid gap-4 rounded-lg border bg-background/40 p-4 md:grid-cols-[1.2fr_1.6fr_.6fr_.9fr_1fr_auto] md:items-start">
                <input type="hidden" {...form.register(`items.${index}.id`)} />
                <FormField id={`items.${index}.service_id`} label="Serviço do catálogo">
                  <NativeSelect
                    disabled={pending}
                    value={items[index]?.service_id ?? ""}
                    onChange={(ev) => pickService(index, ev.target.value)}
                  >
                    <option value="">Personalizado</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField id={`items.${index}.description`} label="Descrição" required error={e?.description?.message}>
                  <Input disabled={pending} {...form.register(`items.${index}.description`)} />
                </FormField>
                <FormField id={`items.${index}.quantity`} label="Qtde" required error={e?.quantity?.message}>
                  <Input inputMode="decimal" disabled={pending} {...form.register(`items.${index}.quantity`)} />
                </FormField>
                <FormField id={`items.${index}.unit_amount`} label="Valor unitário (R$)" required error={e?.unit_amount?.message}>
                  <Input inputMode="decimal" placeholder="0,00" disabled={pending} {...form.register(`items.${index}.unit_amount`)} />
                </FormField>
                <FormField id={`items.${index}.billing_frequency`} label="Periodicidade" error={e?.billing_frequency?.message}>
                  <NativeSelect disabled={pending} {...form.register(`items.${index}.billing_frequency`)}>
                    {BILLING_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {BILLING_FREQUENCY_LABELS[f]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <div className="flex items-center justify-between gap-2 md:mt-[22px] md:block">
                  <span className="text-sm tabular-nums md:hidden">{formatBRL(lineTotal(items[index]) / 100)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending || fields.length === 1}
                    onClick={() => remove(index)}
                    aria-label={`Remover item ${index + 1}`}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || fields.length >= 30}
              onClick={() =>
                append({ id: "", service_id: "", description: "", quantity: "1", unit_amount: "", billing_frequency: "mensal" })
              }
            >
              <Plus /> Adicionar serviço
            </Button>
            <dl className="flex gap-6 text-sm">
              <div>
                <dt className="text-muted-foreground">Mensalidade</dt>
                <dd className="font-serif text-xl font-semibold tabular-nums">{formatBRL(monthly)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Previsão em 12 meses</dt>
                <dd className="font-serif text-xl font-semibold tabular-nums">{formatBRL(yearly)}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Salvar contrato
        </Button>
      </div>
    </form>
  );
}
