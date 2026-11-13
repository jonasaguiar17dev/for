import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATE_LABELS, type ContractState, type ReceivableStatus } from "@/types/domain";

const CONTRACT_VARIANT = { rascunho: "neutral", ativo: "success", suspenso: "warning", encerrado: "neutral" } as const;

export function ContractStateBadge({ status }: { status: ContractState }) {
  return <Badge variant={CONTRACT_VARIANT[status]}>{CONTRACT_STATE_LABELS[status]}</Badge>;
}

export function ReceivableStatusBadge({ status, overdue }: { status: ReceivableStatus; overdue?: boolean }) {
  if (status === "pago") return <Badge variant="success">Pago</Badge>;
  if (status === "cancelado") return <Badge variant="neutral">Cancelado</Badge>;
  return overdue ? <Badge variant="danger">Vencido</Badge> : <Badge variant="info">A vencer</Badge>;
}
