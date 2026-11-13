import { FileSignature, Plus, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContractStateBadge } from "@/components/finance/status-badges";
import { SearchFilters } from "@/components/finance/search-filters";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { contractFiltersSchema } from "@/schemas/finance";
import { searchContracts } from "@/services/finance";
import { CONTRACT_STATE_LABELS, CONTRACT_STATES } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatISODate } from "@/utils/dates";
import { formatBRL } from "@/utils/money";

export const metadata: Metadata = { title: "Contratos" };

export default async function ContractsPage({ searchParams }: PageProps<"/contratos">) {
  const ctx = await requireOrgContext();
  const filters = contractFiltersSchema.parse(await searchParams);
  const contracts = await searchContracts(ctx.organization.id, filters);
  const totalMonthly = contracts.filter((c) => c.status === "ativo").reduce((a, c) => a + c.monthly_amount, 0);

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Contratos"
        description="Contratos de prestação de serviços com os clientes e seus honorários."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/contratos/servicos">
                <Tags /> Catálogo de serviços
              </Link>
            </Button>
            {can(ctx.role, "finance:write") && (
              <Button asChild>
                <Link href="/contratos/novo">
                  <Plus /> Novo contrato
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Card className="p-4 sm:p-5">
        <SearchFilters
          placeholder="Pesquisar por número, cliente ou CNPJ…"
          selects={[
            {
              param: "status",
              label: "Situação do contrato",
              allLabel: "Todas as situações",
              options: CONTRACT_STATES.map((s) => ({ value: s, label: CONTRACT_STATE_LABELS[s] })),
            },
          ]}
        />
        <div className="-mx-4 mt-4 border-t sm:-mx-5">
          {contracts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileSignature className="size-8 text-muted-foreground" />
              <p className="font-medium">Nenhum contrato encontrado</p>
              <p className="text-sm text-muted-foreground">Cadastre o primeiro contrato ou ajuste os filtros.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Contrato</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Mensalidade</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/contratos/${c.id}`} className="font-medium tabular-nums hover:text-primary">
                        {c.number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.items_count} serviço(s) · venc. dia {c.billing_day}</p>
                    </TableCell>
                    <TableCell className="max-w-72">
                      <p className="line-clamp-2">{c.company?.corporate_name ?? "—"}</p>
                      {c.company && <p className="text-xs text-muted-foreground tabular-nums">{formatCnpj(c.company.cnpj)}</p>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatISODate(c.start_date)} {c.end_date ? `a ${formatISODate(c.end_date)}` : "· indeterminado"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{formatBRL(c.monthly_amount)}</TableCell>
                    <TableCell>
                      <ContractStateBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {contracts.length > 0 && (
          <p className="pt-4 text-sm text-muted-foreground">
            {contracts.length} contrato(s) · mensalidades dos ativos listados:{" "}
            <strong className="text-foreground tabular-nums">{formatBRL(totalMonthly)}</strong>
          </p>
        )}
      </Card>
    </>
  );
}
