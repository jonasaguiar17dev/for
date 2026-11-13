"use client";

import { FilePlus2, Loader2, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createReceivable, generateBilling } from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCnpj } from "@/utils/cnpj";
import { todayISO } from "@/utils/dates";

/** Ações do Financeiro: gerar faturamento da competência e lançar cobrança avulsa. */
export function FinanceToolbar({ clients }: { clients: { id: string; corporate_name: string; cnpj: string }[] }) {
  const router = useRouter();
  const [competence, setCompetence] = useState(todayISO().slice(0, 7));
  const [openBilling, setOpenBilling] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FilePlus2 /> Cobrança avulsa
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await createReceivable(Object.fromEntries(fd));
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  toast.error(r.error);
                  return;
                }
                toast.success(r.message ?? "Cobrança lançada.");
                setErrors({});
                setOpenNew(false);
                router.refresh();
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Nova cobrança avulsa</DialogTitle>
              <DialogDescription>Serviço extra ou cobrança fora do contrato.</DialogDescription>
            </DialogHeader>
            <FormField id="company_id" label="Cliente" error={errors.company_id?.[0]}>
              <NativeSelect name="company_id" defaultValue="" required>
                <option value="">Selecione…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.corporate_name} — {formatCnpj(c.cnpj)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="description" label="Descrição" error={errors.description?.[0]}>
              <Input name="description" placeholder="Ex.: Alteração contratual" required />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="competence" label="Competência" error={errors.competence?.[0]}>
                <Input name="competence" type="month" defaultValue={todayISO().slice(0, 7)} required />
              </FormField>
              <FormField id="due_date" label="Vencimento" error={errors.due_date?.[0]}>
                <Input name="due_date" type="date" defaultValue={todayISO()} required />
              </FormField>
              <FormField id="amount" label="Valor (R$)" error={errors.amount?.[0]}>
                <Input name="amount" inputMode="decimal" placeholder="0,00" required />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenNew(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Lançar cobrança
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openBilling} onOpenChange={setOpenBilling}>
        <DialogTrigger asChild>
          <Button>
            <Receipt /> Gerar faturamento
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar faturamento</DialogTitle>
            <DialogDescription>
              Cria as cobranças da competência para todos os contratos ativos, conforme a periodicidade de cada serviço.
              Pode ser executado mais de uma vez: cobranças já geradas não são duplicadas.
            </DialogDescription>
          </DialogHeader>
          <FormField id="billing-competence" label="Competência">
            <Input type="month" value={competence} onChange={(e) => setCompetence(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenBilling(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !competence}
              onClick={() =>
                startTransition(async () => {
                  const r = await generateBilling(competence);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.message ?? "Faturamento gerado.");
                  setOpenBilling(false);
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Gerar cobranças
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
