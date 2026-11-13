"use client";

import { Ban, CircleDollarSign, Loader2, MoreHorizontal, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelReceivable, registerPayment, undoPayment } from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod, type ReceivableStatus } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatCompetence, formatISODate, todayISO } from "@/utils/dates";
import { formatBRL, formatMoneyInput } from "@/utils/money";

import { ReceivableStatusBadge } from "./status-badges";

export type ReceivableView = {
  id: string;
  company_id: string;
  corporate_name?: string;
  cnpj?: string;
  contract_id: string | null;
  contract_number?: string | null;
  description: string;
  competence: string;
  due_date: string;
  amount: number;
  status: ReceivableStatus;
  is_overdue: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: PaymentMethod | null;
};

export function ReceivablesTable({
  rows,
  canWrite,
  showCompany = true,
}: {
  rows: ReceivableView[];
  canWrite: boolean;
  showCompany?: boolean;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState<ReceivableView | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Salvo.");
        router.refresh();
      } else toast.error(r.error);
    });

  if (!rows.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma cobrança encontrada.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {showCompany && <TableHead>Cliente</TableHead>}
            <TableHead>Descrição</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Situação</TableHead>
            {canWrite && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              {showCompany && (
                <TableCell className="max-w-64">
                  <Link href={`/clientes/${r.company_id}`} className="line-clamp-2 font-medium hover:text-primary">
                    {r.corporate_name}
                  </Link>
                  {r.cnpj && <p className="text-xs text-muted-foreground tabular-nums">{formatCnpj(r.cnpj)}</p>}
                </TableCell>
              )}
              <TableCell className="max-w-72">
                <p className="line-clamp-2">{r.description}</p>
                {r.contract_id && r.contract_number && (
                  <Link href={`/contratos/${r.contract_id}`} className="text-xs text-primary hover:underline">
                    {r.contract_number}
                  </Link>
                )}
              </TableCell>
              <TableCell className="tabular-nums">{formatCompetence(r.competence)}</TableCell>
              <TableCell className="tabular-nums whitespace-nowrap">{formatISODate(r.due_date)}</TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {formatBRL(r.amount)}
                {r.status === "pago" && r.paid_amount !== null && r.paid_amount !== r.amount && (
                  <p className="text-xs text-muted-foreground">pago {formatBRL(r.paid_amount)}</p>
                )}
              </TableCell>
              <TableCell>
                <ReceivableStatusBadge status={r.status} overdue={r.is_overdue} />
                {r.status === "pago" && r.paid_at && (
                  <p className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">
                    {formatISODate(r.paid_at)} · {r.payment_method ? PAYMENT_METHOD_LABELS[r.payment_method] : ""}
                  </p>
                )}
              </TableCell>
              {canWrite && (
                <TableCell>
                  {r.status !== "cancelado" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações da cobrança" disabled={pending}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {r.status === "aberto" ? (
                          <>
                            <DropdownMenuItem onSelect={() => setPaying(r)}>
                              <CircleDollarSign /> Registrar pagamento
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onSelect={() => run(() => cancelReceivable(r.id))}>
                              <Ban /> Cancelar cobrança
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onSelect={() => run(() => undoPayment(r.id))}>
                            <Undo2 /> Estornar pagamento
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaymentDialog
        receivable={paying}
        onClose={() => setPaying(null)}
        onDone={() => {
          setPaying(null);
          router.refresh();
        }}
      />
    </>
  );
}

function PaymentDialog({
  receivable,
  onClose,
  onDone,
}: {
  receivable: ReceivableView | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={receivable !== null} onOpenChange={(o) => !o && onClose()}>
      {receivable && (
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await registerPayment(receivable.id, Object.fromEntries(fd));
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  toast.error(r.error);
                  return;
                }
                toast.success(r.message ?? "Pagamento registrado.");
                setErrors({});
                onDone();
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Registrar pagamento</DialogTitle>
              <DialogDescription>
                {receivable.description} · {formatBRL(receivable.amount)}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="paid_at" label="Data do pagamento" error={errors.paid_at?.[0]}>
                <Input name="paid_at" type="date" defaultValue={todayISO()} required />
              </FormField>
              <FormField id="paid_amount" label="Valor pago (R$)" error={errors.paid_amount?.[0]}>
                <Input name="paid_amount" inputMode="decimal" defaultValue={formatMoneyInput(receivable.amount)} required />
              </FormField>
            </div>
            <FormField id="payment_method" label="Forma de pagamento" error={errors.payment_method?.[0]}>
              <NativeSelect name="payment_method" defaultValue="pix">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Confirmar pagamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
