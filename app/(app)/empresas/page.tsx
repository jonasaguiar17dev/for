import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CompaniesTable } from "@/components/clients/companies-table";
import { Pagination, pageHref } from "@/components/clients/pagination";
import { SearchFilters } from "@/components/finance/search-filters";
import { StatusTabs } from "@/components/finance/status-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { companyFiltersSchema } from "@/schemas/company";
import { PAGE_SIZE, searchCompanies } from "@/services/companies";
import { COMPANY_STATUS_LABELS, TAX_REGIME_LABELS, TAX_REGIMES } from "@/types/domain";

export const metadata: Metadata = { title: "Empresas" };

const TABS = [
  { value: "ativa", label: COMPANY_STATUS_LABELS.ativa, dot: "var(--success)" },
  { value: "suspensa", label: COMPANY_STATUS_LABELS.suspensa, dot: "var(--warning)" },
  { value: "inapta", label: COMPANY_STATUS_LABELS.inapta, dot: "var(--danger)" },
  { value: "baixada", label: COMPANY_STATUS_LABELS.baixada, dot: "var(--faint)" },
  { value: "nula", label: COMPANY_STATUS_LABELS.nula, dot: "var(--faint)" },
];

export default async function CompaniesPage({ searchParams }: PageProps<"/empresas">) {
  const ctx = await requireOrgContext();
  const filters = companyFiltersSchema.parse(await searchParams);
  const result = await searchCompanies({
    organizationId: ctx.organization.id,
    q: filters.q,
    regime: filters.regime,
    companyStatus: filters.situacao,
    clientsOnly: false,
    page: filters.page,
  });
  const keep = { q: filters.q, regime: filters.regime, situacao: filters.situacao };

  return (
    <>
      <PageHeader
        eyebrow="Cadastros"
        title="Empresas"
        description="Todos os CNPJs administrados, incluindo o CNPJ interno da organização, com a situação na Receita Federal."
        actions={
          can(ctx.role, "company:create") && (
            <Button asChild>
              <Link href="/clientes/novo">
                <Plus /> Nova empresa cliente
              </Link>
            </Button>
          )
        }
      />
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4">
          <StatusTabs basePath="/empresas" param="situacao" current={filters.situacao} options={TABS} keep={keep} />
          <SearchFilters
            placeholder="Pesquisar por razão social, nome fantasia ou CNPJ…"
            selects={[
              {
                param: "regime",
                label: "Regime tributário",
                allLabel: "Todos os regimes",
                options: TAX_REGIMES.map((r) => ({ value: r, label: TAX_REGIME_LABELS[r] })),
              },
            ]}
          />
        </div>
        <CompaniesTable rows={result.rows} hrefBase="/empresas" mode="companies" />
        <div className="border-t border-border px-4 sm:px-5">
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={PAGE_SIZE}
            buildHref={(p) => pageHref("/empresas", keep, p)}
          />
        </div>
      </Card>
    </>
  );
}
