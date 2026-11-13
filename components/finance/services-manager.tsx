"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteService, saveService } from "@/app/(app)/contratos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ServiceRow } from "@/types/database";
import { BILLING_FREQUENCIES, BILLING_FREQUENCY_LABELS, type BillingFrequency } from "@/types/domain";
import { formatBRL, formatMoneyInput } from "@/utils/money";

type Draft = { id: string | null; name: string; description: string; default_amount: string; billing_frequency: BillingFrequency; active: boolean };
const EMPTY: Draft = { id: null, name: "", description: "", default_amount: "", billing_frequency: "mensal", active: true };

export function ServicesManager({ services, canManage }: { services: ServiceRow[]; canManage: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const { id, ...input } = draft;
      const r = await saveService(id, input);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Salvo.");
      setDraft(EMPTY);
      setErrors({});
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6">
      {canManage && (
        <form onSubmit={submit} className="grid gap-4 rounded-lg border border-dashed p-4 md:grid-cols-[1.4fr_1.6fr_.9fr_1fr_auto] md:items-start" noValidate>
          <FormField id="svc-name" label="Serviço" required error={errors.name?.[0]}>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </FormField>
          <FormField id="svc-desc" label="Descrição" error={errors.description?.[0]}>
            <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </FormField>
          <FormField id="svc-amount" label="Valor padrão (R$)" error={errors.default_amount?.[0]}>
            <Input inputMode="decimal" placeholder="0,00" value={draft.default_amount} onChange={(e) => setDraft({ ...draft, default_amount: e.target.value })} />
          </FormField>
          <FormField id="svc-freq" label="Periodicidade" error={errors.billing_frequency?.[0]}>
            <NativeSelect value={draft.billing_frequency} onChange={(e) => setDraft({ ...draft, billing_frequency: e.target.value as BillingFrequency })}>
              {BILLING_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {BILLING_FREQUENCY_LABELS[f]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="flex gap-2 md:mt-[22px]">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              {draft.id ? "Salvar" : "Adicionar"}
            </Button>
            {draft.id && (
              <Button type="button" variant="ghost" onClick={() => setDraft(EMPTY)}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}

      {services.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
      ) : (
        <div className="-mx-5 sm:-mx-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Serviço</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead className="text-right">Valor padrão</TableHead>
                <TableHead>Situação</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium">{s.name}</p>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  </TableCell>
                  <TableCell>{BILLING_FREQUENCY_LABELS[s.billing_frequency]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(s.default_amount)}</TableCell>
                  <TableCell>
                    <Badge variant={s.active ? "success" : "neutral"}>{s.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await saveService(s.id, { ...s, description: s.description ?? "", active: !s.active });
                            if (!r.ok) return void toast.error(r.error);
                            router.refresh();
                          })
                        }
                      >
                        {s.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${s.name}`}
                        onClick={() =>
                          setDraft({
                            id: s.id,
                            name: s.name,
                            description: s.description ?? "",
                            default_amount: formatMoneyInput(s.default_amount),
                            billing_frequency: s.billing_frequency,
                            active: s.active,
                          })
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${s.name}`}
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Excluir o serviço "${s.name}"?`)) return;
                          startTransition(async () => {
                            const r = await deleteService(s.id);
                            if (!r.ok) return void toast.error(r.error);
                            toast.success(r.message ?? "Excluído.");
                            router.refresh();
                          });
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
