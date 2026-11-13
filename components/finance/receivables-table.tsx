"use client";

import { Ban, CircleDollarSign, Loader2, MoreHorizontal, Receipt, Undo2 } from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod, type ReceivableStatus } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatCompetence, formatISODate, todayISO } from "@/utils/dates";
import { formatBRL, formatMoneyInput } from "@/utils/money";
import { dueHint, receivableState } from "@/utils/receivable-state";

import { ReceivableStateBadge } from "./status-badges";

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

const AMOUNT_TONE = {
  pago: "text-success",
  vencido: "text-danger",
  pendente: "text-warning",
  a_receber: "text-foreground",
  cancelado: "text-faint line-through",
} as const;

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
  const today = todayISO();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Salvo.");
        router.refresh();
      } else toast.error(r.error);
    });

  if (!rows.length) {
    return <EmptyState icon={Receipt} title="Nenhuma cobrança encontrada" description="Ajuste os filtros ou gere o faturamento da competência." />;
  }

  const actions = (r: ReceivableView) =>
    canWrite &&
    r.status !== "cancelado" && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Ações da cobrança" disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {r.status === "aberto" ? (
            <>
              <DropdownMenuItem onSelect={() => setPaying(r)}>
                <CircleDollarSign /> Registrar pagamento
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger [&_svg]:!text-danger" onSelect={() => run(() => cancelReceivable(r.id))}>
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
    );

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {showCompany && <TableHead>Cliente</TableHead>}
              <TableHead>Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Situação</TableHead>
              {canWrite && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const state = receivableState(r.status, r.due_date, today);
              return (
                <TableRow key={r.id}>
                  {showCompany && (
                    <TableCell className="max-w-64">
                      <Link href={`/clientes/${r.company_id}`} className="line-clamp-1 font-medium hover:text-primary">
                        {r.corporate_name}
                      </Link>
                      {r.cnpj && <p className="font-mono text-[11px] text-muted-foreground">{formatCnpj(r.cnpj)}</p>}
                    </TableCell>
                  )}
                  <TableCell className="max-w-72">
                    <p className="line-clamp-1">{r.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Competência {formatCompetence(r.competence)}
                      {r.contract_id && r.contract_number && (
                        <>
                          {" · "}
                          <Link href={`/contratos/${r.contract_id}`} className="font-mono hover:text-primary">
                            {r.contract_number}
                          </Link>
                        </>
                      )}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="num">{formatISODate(r.due_date)}</p>
                    {r.status === "aberto" && (
                      <p className={cn("text-xs", state === "vencido" ? "text-danger" : state === "pendente" ? "text-warning" : "text-muted-foreground")}>
                        {dueHint(r.due_date, today)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <p className={cn("num font-semibold", AMOUNT_TONE[state])}>{formatBRL(r.amount)}</p>
                    {r.status === "pago" && r.paid_amount !== null && r.paid_amount !== r.amount && (
                      <p className="num text-xs text-muted-foreground">pago {formatBRL(r.paid_amount)}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <ReceivableStateBadge state={state} />
                    {r.status === "pago" && r.paid_at && (
                      <p className="mt-1 text-xs whitespace-nowrap text-muted-foreground">
                        {formatISODate(r.paid_at)} · {r.payment_method ? PAYMENT_METHOD_LABELS[r.payment_method] : ""}
                      </p>
                    )}
                  </TableCell>
                  {canWrite && <TableCell>{actions(r)}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Celular */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((r) => {
          const state = receivableState(r.status, r.due_date, today);
          return (
            <li key={r.id} className="flex gap-3 px-4 py-3.5">
              <span
                aria-hidden
                className={cn(
                  "mt-1 w-1 shrink-0 self-stretch rounded-full",
                  state === "pago" && "bg-success",
                  state === "vencido" && "bg-danger",
                  state === "pendente" && "bg-warning",
                  state === "a_receber" && "bg-border-strong",
                  state === "cancelado" && "bg-border",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {showCompany && <p className="truncate text-sm font-medium">{r.corporate_name}</p>}
                    <p className={cn("truncate text-sm", showCompany && "text-muted-foreground")}>{r.description}</p>
                  </div>
                  <p className={cn("num shrink-0 text-sm font-semibold", AMOUNT_TONE[state])}>{formatBRL(r.amount)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <ReceivableStateBadge state={state} />
                    <span className="text-xs text-muted-foreground">
                      {r.status === "pago" && r.paid_at ? `pago em ${formatISODate(r.paid_at)}` : `${formatISODate(r.due_date)} · ${dueHint(r.due_date, today)}`}
                    </span>
                  </div>
                  {actions(r)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

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
            className="grid gap-5"
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
              <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-success-soft text-success">
                <CircleDollarSign className="size-5" />
              </div>
              <DialogTitle>Registrar pagamento</DialogTitle>
              <DialogDescription>
                {receivable.corporate_name ? `${receivable.corporate_name} · ` : ""}
                {receivable.description}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-border bg-subtle/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Valor da cobrança</p>
              <p className="num text-2xl font-semibold tracking-tight">{formatBRL(receivable.amount)}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="paid_at" label="Data do pagamento" error={errors.paid_at?.[0]}>
                <Input name="paid_at" type="date" defaultValue={todayISO()} required />
              </FormField>
              <FormField id="paid_amount" label="Valor pago (R$)" error={errors.paid_amount?.[0]}>
                <Input name="paid_amount" inputMode="decimal" className="num" defaultValue={formatMoneyInput(receivable.amount)} required />
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
              <Button type="button" variant="outline" onClick={onClose}>
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
