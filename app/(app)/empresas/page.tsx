import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CompaniesTable } from "@/components/clients/companies-table";
import { ListFilters } from "@/components/clients/list-filters";
import { Pagination, pageHref } from "@/components/clients/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { companyFiltersSchema } from "@/schemas/company";
import { PAGE_SIZE, searchCompanies } from "@/services/companies";
import { COMPANY_STATUS_LABELS, COMPANY_STATUSES } from "@/types/domain";

export const metadata: Metadata = { title: "Empresas" };

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
        eyebrow="Cadastro"
        title="Empresas"
        description="Todos os CNPJs administrados, incluindo o CNPJ interno da organização."
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
      <Card className="p-4 sm:p-5">
        <ListFilters
          statusParam="situacao"
          statusLabel="Situação RFB"
          statusOptions={COMPANY_STATUSES.map((s) => ({ value: s, label: COMPANY_STATUS_LABELS[s] }))}
        />
        <div className="-mx-4 mt-4 border-t sm:-mx-5">
          <CompaniesTable rows={result.rows} hrefBase="/empresas" mode="companies" />
        </div>
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={PAGE_SIZE}
          buildHref={(p) => pageHref("/empresas", keep, p)}
        />
      </Card>
    </>
  );
}
