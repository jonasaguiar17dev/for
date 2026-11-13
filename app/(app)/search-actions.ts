"use server";

import { z } from "zod";

import { requireOrgContext } from "@/lib/auth/session";
import { searchCompanies } from "@/services/companies";
import { searchContracts } from "@/services/finance";
import { formatCnpj } from "@/utils/cnpj";

export type SearchHit = { group: string; label: string; sub?: string; href: string; kind: "client" | "company" | "contract" };

/** Busca global (paleta Ctrl+K) em clientes, empresas e contratos, sob RLS. */
export async function globalSearch(input: string): Promise<SearchHit[]> {
  const q = z.string().trim().min(2).max(100).safeParse(input);
  if (!q.success) return [];
  const ctx = await requireOrgContext();
  const [companies, contracts] = await Promise.all([
    searchCompanies({ organizationId: ctx.organization.id, q: q.data, clientsOnly: false, page: 1 }),
    searchContracts(ctx.organization.id, { q: q.data }),
  ]);
  return [
    ...companies.rows.slice(0, 8).map((c) => ({
      group: c.client_id ? "Clientes" : "Empresas",
      label: c.corporate_name,
      sub: formatCnpj(c.cnpj),
      href: `/${c.client_id ? "clientes" : "empresas"}/${c.company_id}`,
      kind: (c.client_id ? "client" : "company") as SearchHit["kind"],
    })),
    ...contracts.slice(0, 5).map((c) => ({
      group: "Contratos",
      label: c.number,
      sub: c.company?.corporate_name,
      href: `/contratos/${c.id}`,
      kind: "contract" as const,
    })),
  ];
}
