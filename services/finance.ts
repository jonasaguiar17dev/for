import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AuditLogRow,
  CompanyRow,
  ContractItemRow,
  ContractRow,
  FinanceSummary,
  ReceivableRow,
  SearchReceivablesRow,
  ServiceRow,
} from "@/types/database";
import type { ContractState, ReceivableFilter } from "@/types/domain";
import { todayISO } from "@/utils/dates";
import { sumItems } from "@/utils/money";

export const RECEIVABLES_PAGE_SIZE = 20;

const toNumber = <T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): T => {
  const out = { ...row };
  for (const k of keys) if (out[k] !== null && out[k] !== undefined) (out[k] as unknown) = Number(out[k]);
  return out;
};

export async function listServices(organizationId: string, onlyActive = false): Promise<ServiceRow[]> {
  const supabase = await createClient();
  let query = supabase.from("services").select("*").eq("organization_id", organizationId).order("name");
  if (onlyActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os serviços.");
  return (data ?? []).map((s) => toNumber(s, ["default_amount"]));
}

export type ClientOption = Pick<CompanyRow, "id" | "corporate_name" | "trade_name" | "cnpj">;

/** Empresas (exceto o CNPJ interno) que o usuário enxerga, para seletores. */
export async function listClientOptions(organizationId: string): Promise<ClientOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, corporate_name, trade_name, cnpj")
    .eq("organization_id", organizationId)
    .eq("is_internal", false)
    .order("corporate_name");
  if (error) throw new Error("Não foi possível carregar os clientes.");
  return data ?? [];
}

export type ContractListEntry = ContractRow & {
  company: ClientOption | null;
  monthly_amount: number;
  items_count: number;
};

export async function searchContracts(
  organizationId: string,
  filters: { q?: string; status?: ContractState; companyId?: string },
): Promise<ContractListEntry[]> {
  const supabase = await createClient();
  let query = supabase.from("contracts").select("*").eq("organization_id", organizationId).order("number", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.companyId) query = query.eq("company_id", filters.companyId);
  const { data: contracts, error } = await query;
  if (error) throw new Error("Não foi possível carregar os contratos.");
  if (!contracts?.length) return [];

  const ids = contracts.map((c) => c.id);
  const companyIds = [...new Set(contracts.map((c) => c.company_id))];
  const [{ data: items }, { data: companies }] = await Promise.all([
    supabase.from("contract_items").select("contract_id, quantity, unit_amount, billing_frequency").in("contract_id", ids),
    supabase.from("companies").select("id, corporate_name, trade_name, cnpj").in("id", companyIds),
  ]);
  const byCompany = new Map((companies ?? []).map((c) => [c.id, c]));

  const term = filters.q?.toLowerCase().trim();
  const termCnpj = filters.q?.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return contracts
    .map((c) => {
      const its = (items ?? []).filter((i) => i.contract_id === c.id);
      return {
        ...c,
        company: byCompany.get(c.company_id) ?? null,
        items_count: its.length,
        monthly_amount: sumItems(
          its.filter((i) => i.billing_frequency === "mensal").map((i) => ({ quantity: Number(i.quantity), unit_amount: Number(i.unit_amount) })),
        ),
      };
    })
    .filter(
      (c) =>
        !term ||
        c.number.toLowerCase().includes(term) ||
        c.company?.corporate_name.toLowerCase().includes(term) ||
        (c.company?.trade_name ?? "").toLowerCase().includes(term) ||
        (termCnpj && termCnpj.length >= 2 && c.company?.cnpj.includes(termCnpj)),
    );
}

export type ContractDetail = {
  contract: ContractRow;
  company: ClientOption;
  items: ContractItemRow[];
  receivables: ReceivableRow[];
  history: (AuditLogRow & { author: string | null })[];
};

export async function getContractDetail(id: string, organizationId: string): Promise<ContractDetail | null> {
  const supabase = await createClient();
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o contrato.");
  if (!contract) return null;

  const [company, items, receivables, logs] = await Promise.all([
    supabase.from("companies").select("id, corporate_name, trade_name, cnpj").eq("id", contract.company_id).maybeSingle(),
    supabase.from("contract_items").select("*").eq("contract_id", id).order("created_at"),
    supabase.from("receivables").select("*").eq("contract_id", id).order("competence", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("company_id", contract.company_id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (!company.data) return null;

  const itemIds = new Set((items.data ?? []).map((i) => i.id));
  const related = (logs.data ?? []).filter((l) => {
    if (l.entity === "contracts") return l.entity_id === id;
    if (l.entity === "contract_items") {
      const ch = (l.changes ?? {}) as { new?: { contract_id?: string }; old?: { contract_id?: string } };
      return (l.entity_id && itemIds.has(l.entity_id)) || ch.new?.contract_id === id || ch.old?.contract_id === id;
    }
    return false;
  });
  const userIds = [...new Set(related.map((l) => l.user_id).filter((x): x is string => Boolean(x)))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  return {
    contract,
    company: company.data,
    items: (items.data ?? []).map((i) => toNumber(i, ["quantity", "unit_amount"])),
    receivables: (receivables.data ?? []).map((r) => toNumber(r, ["amount", "paid_amount"])),
    history: related.map((l) => ({ ...l, author: l.user_id ? (name.get(l.user_id) ?? null) : null })),
  };
}

export async function getFinanceSummary(organizationId: string): Promise<FinanceSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_summary", { p_organization_id: organizationId, p_today: todayISO() });
  if (error) throw new Error("Não foi possível carregar os indicadores financeiros.");
  const s = data as unknown as FinanceSummary;
  return {
    ...s,
    open_total: Number(s.open_total),
    overdue_total: Number(s.overdue_total),
    due_soon_total: Number(s.due_soon_total ?? 0),
    due_soon_count: Number(s.due_soon_count ?? 0),
    month_billed: Number(s.month_billed),
    month_received: Number(s.month_received),
    mrr: Number(s.mrr),
    received_by_month: s.received_by_month.map((m) => ({ ...m, billed: Number(m.billed), received: Number(m.received) })),
  };
}

export type ReceivableSearch = {
  rows: SearchReceivablesRow[];
  total: number;
  totalAmount: number;
  page: number;
  pageCount: number;
};

export async function searchReceivables(
  organizationId: string,
  filters: { q?: string; status?: ReceivableFilter; competence?: string; companyId?: string; page?: number },
): Promise<ReceivableSearch> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const { data, error } = await supabase.rpc("search_receivables", {
    p_organization_id: organizationId,
    p_search: filters.q || null,
    p_status: filters.status ?? null,
    p_competence: filters.competence ? `${filters.competence}-01` : null,
    p_company_id: filters.companyId ?? null,
    p_today: todayISO(),
    p_limit: RECEIVABLES_PAGE_SIZE,
    p_offset: (page - 1) * RECEIVABLES_PAGE_SIZE,
  });
  if (error) throw new Error("Não foi possível carregar as cobranças.");
  const rows = (data ?? []).map((r) => toNumber(r, ["amount", "paid_amount", "total_count", "total_amount"]));
  const total = rows[0]?.total_count ?? 0;
  return {
    rows,
    total,
    totalAmount: rows[0]?.total_amount ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil(total / RECEIVABLES_PAGE_SIZE)),
  };
}
