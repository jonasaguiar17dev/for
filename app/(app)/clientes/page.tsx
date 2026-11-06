import { Download, Plus } from "lucide-react";
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
import { clientFiltersSchema } from "@/schemas/company";
import { PAGE_SIZE, searchCompanies } from "@/services/companies";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES } from "@/types/domain";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  const ctx = await requireOrgContext();
  const filters = clientFiltersSchema.parse(await searchParams);
  const result = await searchCompanies({
    organizationId: ctx.organization.id,
    q: filters.q,
    regime: filters.regime,
    contractStatus: filters.status,
    clientsOnly: true,
    page: filters.page,
  });
  const keep = { q: filters.q, regime: filters.regime, status: filters.status };

  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        title="Clientes"
        description="Empresas atendidas pelo escritório e situação contratual."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/relatorios/clientes.csv" prefetch={false}>
                <Download /> Exportar CSV
              </Link>
            </Button>
            {can(ctx.role, "company:create") && (
              <Button asChild>
                <Link href="/clientes/novo">
                  <Plus /> Novo cliente
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Card className="p-4 sm:p-5">
        <ListFilters
          statusParam="status"
          statusLabel="Situação"
          statusOptions={CONTRACT_STATUSES.map((s) => ({ value: s, label: CONTRACT_STATUS_LABELS[s] }))}
        />
        <div className="-mx-4 mt-4 border-t sm:-mx-5">
          <CompaniesTable rows={result.rows} hrefBase="/clientes" mode="clients" />
        </div>
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={PAGE_SIZE}
          buildHref={(p) => pageHref("/clientes", keep, p)}
        />
      </Card>
    </>
  );
}
