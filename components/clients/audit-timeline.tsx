import { History } from "lucide-react";

import type { AuditEntry } from "@/services/companies";
import {
  COMPANY_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  ONBOARDING_STATUS_LABELS,
  TAX_REGIME_LABELS,
} from "@/types/domain";
import { formatDateTime } from "@/utils/format";

const ENTITY_LABELS: Record<string, string> = {
  companies: "Empresa",
  clients: "Cliente",
  client_contacts: "Contato",
  client_documents: "Documento",
  company_members: "Acesso",
};

const ACTION_LABELS = { insert: "criou", update: "alterou", delete: "excluiu" } as const;

const FIELD_LABELS: Record<string, string> = {
  corporate_name: "Razão social",
  trade_name: "Nome fantasia",
  cnpj: "CNPJ",
  tax_regime: "Regime tributário",
  state_registration: "Inscrição estadual",
  municipal_registration: "Inscrição municipal",
  cnae: "CNAE",
  address: "Endereço",
  status: "Situação cadastral",
  responsible_name: "Responsável",
  email: "E-mail",
  phone: "Telefone",
  contract_status: "Situação do cliente",
  onboarding_status: "Implantação",
  notes: "Observações",
  name: "Nome",
  position: "Cargo",
  document_name: "Nome do documento",
  document_type: "Tipo de documento",
  role: "Papel",
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  tax_regime: TAX_REGIME_LABELS,
  status: COMPANY_STATUS_LABELS,
  contract_status: CONTRACT_STATUS_LABELS,
  onboarding_status: ONBOARDING_STATUS_LABELS,
  document_type: DOCUMENT_TYPE_LABELS,
};

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .filter(Boolean)
      .join(", ") || "—";
  }
  const text = String(value);
  return VALUE_LABELS[field]?.[text] ?? text;
}

function describeTarget(entry: AuditEntry): string {
  const changes = (entry.changes ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const row = changes.new ?? changes.old;
  const name = row?.name ?? row?.document_name;
  return name ? ` “${String(name)}”` : "";
}

/** Histórico de alterações (trilha de auditoria gravada pelo banco). */
export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma alteração registrada.</p>;
  }
  return (
    <ol className="relative grid gap-5 border-l pl-6">
      {entries.map((entry) => {
        const changes =
          entry.action === "update" ? Object.entries((entry.changes ?? {}) as Record<string, { old: unknown; new: unknown }>) : [];
        return (
          <li key={entry.id} className="relative">
            <span className="absolute top-1 -left-[31px] flex size-4 items-center justify-center rounded-full border bg-card">
              <History className="size-2.5 text-primary" />
            </span>
            <p className="text-sm">
              <span className="font-medium">{entry.author ?? "Sistema"}</span> {ACTION_LABELS[entry.action]}{" "}
              {(ENTITY_LABELS[entry.entity] ?? entry.entity).toLowerCase()}
              {describeTarget(entry)}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
            {changes.length > 0 && (
              <ul className="mt-2 grid gap-1 rounded-md bg-muted/60 p-2 text-xs">
                {changes.map(([field, diff]) => (
                  <li key={field} className="break-words">
                    <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>{" "}
                    <span className="text-muted-foreground line-through">{show(field, diff?.old)}</span> →{" "}
                    <span>{show(field, diff?.new)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
