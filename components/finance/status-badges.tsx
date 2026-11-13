import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATE_LABELS, type ContractState } from "@/types/domain";
import type { ReceivableState } from "@/utils/receivable-state";

const CONTRACT_VARIANT = { rascunho: "neutral", ativo: "success", suspenso: "warning", encerrado: "neutral" } as const;

export function ContractStateBadge({ status }: { status: ContractState }) {
  return (
    <Badge dot variant={CONTRACT_VARIANT[status]}>
      {CONTRACT_STATE_LABELS[status]}
    </Badge>
  );
}

const RECEIVABLE = {
  pago: { variant: "success", label: "Recebido" },
  vencido: { variant: "danger", label: "Vencido" },
  pendente: { variant: "warning", label: "Vence em breve" },
  a_receber: { variant: "neutral", label: "A receber" },
  cancelado: { variant: "outline", label: "Cancelado" },
} as const;

export function ReceivableStateBadge({ state }: { state: ReceivableState }) {
  const s = RECEIVABLE[state];
  return (
    <Badge dot variant={s.variant} className={state === "cancelado" ? "text-muted-foreground line-through" : undefined}>
      {s.label}
    </Badge>
  );
}
