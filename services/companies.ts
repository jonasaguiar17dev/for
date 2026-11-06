import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AuditLogRow,
  ClientContactRow,
  ClientDocumentRow,
  ClientRow,
  CompanyMemberRow,
  CompanyRow,
  ProfileRow,
  SearchCompaniesRow,
} from "@/types/database";
import type { CompanyStatus, ContractStatus, TaxRegime } from "@/types/domain";

export const PAGE_SIZE = 20;

export type SearchParams = {
  organizationId: string;
  q?: string;
  regime?: TaxRegime;
  contractStatus?: ContractStatus;
  companyStatus?: CompanyStatus;
  clientsOnly: boolean;
  page: number;
};

export type SearchResult = {
  rows: SearchCompaniesRow[];
  total: number;
  page: number;
  pageCount: number;
};

/** Listagem paginada com pesquisa por nome/CNPJ e filtros (RPC sob RLS). */
export async function searchCompanies(params: SearchParams): Promise<SearchResult> {
  const supabase = await createClient();
  const page = Math.max(1, params.page);
  const { data, error } = await supabase.rpc("search_companies", {
    p_organization_id: params.organizationId,
    p_search: params.q || null,
    p_tax_regime: params.regime ?? null,
    p_contract_status: params.contractStatus ?? null,
    p_company_status: params.companyStatus ?? null,
    p_clients_only: params.clientsOnly,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error("Não foi possível carregar a listagem.");

  const rows = data ?? [];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type AuditEntry = AuditLogRow & { author: string | null };
export type CompanyAccessEntry = CompanyMemberRow & { profile: Pick<ProfileRow, "full_name" | "email"> | null };

export type CompanyDetail = {
  company: CompanyRow;
  client: ClientRow | null;
  contacts: ClientContactRow[];
  documents: ClientDocumentRow[];
  history: AuditEntry[];
  access: CompanyAccessEntry[];
};

/**
 * Carrega a ficha completa de uma empresa. Retorna null quando a empresa não
 * existe, pertence a outra organização ou o usuário não tem acesso (RLS).
 */
export async function getCompanyDetail(companyId: string, organizationId: string): Promise<CompanyDetail | null> {
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar a empresa.");
  if (!company) return null;

  const [client, contacts, documents, history, access] = await Promise.all([
    supabase.from("clients").select("*").eq("company_id", companyId).maybeSingle(),
    supabase.from("client_contacts").select("*").eq("company_id", companyId).order("created_at"),
    supabase.from("client_documents").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("company_members").select("*").eq("company_id", companyId).order("created_at"),
  ]);

  for (const result of [client, contacts, documents, history, access]) {
    if (result.error) throw new Error("Não foi possível carregar os dados da empresa.");
  }

  const userIds = [
    ...new Set([
      ...(history.data ?? []).map((h) => h.user_id),
      ...(access.data ?? []).map((a) => a.user_id),
    ]),
  ].filter((id): id is string => Boolean(id));

  const profiles = userIds.length
    ? ((await supabase.from("profiles").select("id, full_name, email").in("id", userIds)).data ?? [])
    : [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return {
    company,
    client: client.data,
    contacts: contacts.data ?? [],
    documents: documents.data ?? [],
    history: (history.data ?? []).map((h) => {
      const p = h.user_id ? profileById.get(h.user_id) : undefined;
      return { ...h, author: p ? p.full_name || p.email : null };
    }),
    access: (access.data ?? []).map((a) => {
      const p = profileById.get(a.user_id);
      return { ...a, profile: p ? { full_name: p.full_name, email: p.email } : null };
    }),
  };
}
