import { Badge } from "@/components/ui/badge";
import {
  COMPANY_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  ONBOARDING_STATUS_LABELS,
  type CompanyStatus,
  type ContractStatus,
  type OnboardingStatus,
} from "@/types/domain";

const CONTRACT_VARIANT = {
  ativo: "success",
  em_implantacao: "info",
  suspenso: "warning",
  encerrado: "neutral",
} as const;

const COMPANY_VARIANT = {
  ativa: "success",
  suspensa: "warning",
  inapta: "danger",
  baixada: "neutral",
  nula: "neutral",
} as const;

const ONBOARDING_VARIANT = {
  nao_iniciado: "neutral",
  em_andamento: "info",
  concluido: "success",
} as const;

export function ContractStatusBadge({ status }: { status: ContractStatus | null | undefined }) {
  if (!status) return <Badge variant="neutral">Sem contrato</Badge>;
  return (
    <Badge dot variant={CONTRACT_VARIANT[status]}>
      {CONTRACT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <Badge dot variant={COMPANY_VARIANT[status]}>
      {COMPANY_STATUS_LABELS[status]}
    </Badge>
  );
}

export function OnboardingStatusBadge({ status }: { status: OnboardingStatus }) {
  return <Badge variant={ONBOARDING_VARIANT[status]}>{ONBOARDING_STATUS_LABELS[status]}</Badge>;
}
