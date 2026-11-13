import { Download, Plus } from "lucide-react";
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
import { clientFiltersSchema } from "@/schemas/company";
import { PAGE_SIZE, searchCompanies } from "@/services/companies";
import { CONTRACT_STATUS_LABELS, TAX_REGIME_LABELS, TAX_REGIMES } from "@/types/domain";

export const metadata: Metadata = { title: "Clientes" };

const TABS = [
  { value: "ativo", label: CONTRACT_STATUS_LABELS.ativo, dot: "var(--success)" },
  { value: "em_implantacao", label: CONTRACT_STATUS_LABELS.em_implantacao, dot: "var(--info)" },
  { value: "suspenso", label: CONTRACT_STATUS_LABELS.suspenso, dot: "var(--warning)" },
  { value: "encerrado", label: CONTRACT_STATUS_LABELS.encerrado, dot: "var(--faint)" },
];

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
        eyebrow="Cadastros"
        title="Clientes"
        description="Empresas atendidas pelo escritório e situação contratual de cada uma."
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
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4">
          <StatusTabs basePath="/clientes" param="status" current={filters.status} options={TABS} keep={keep} />
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
        <CompaniesTable rows={result.rows} hrefBase="/clientes" mode="clients" />
        <div className="border-t border-border px-4 sm:px-5">
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={PAGE_SIZE}
            buildHref={(p) => pageHref("/clientes", keep, p)}
          />
        </div>
      </Card>
    </>
  );
}
