import { ChevronRight, FileSignature, Plus, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SearchFilters } from "@/components/finance/search-filters";
import { ContractStateBadge } from "@/components/finance/status-badges";
import { StatusTabs } from "@/components/finance/status-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { contractFiltersSchema } from "@/schemas/finance";
import { searchContracts } from "@/services/finance";
import { CONTRACT_STATE_LABELS } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatISODate } from "@/utils/dates";
import { formatBRL } from "@/utils/money";

export const metadata: Metadata = { title: "Contratos" };

const TABS = [
  { value: "ativo", label: CONTRACT_STATE_LABELS.ativo, dot: "var(--success)" },
  { value: "rascunho", label: CONTRACT_STATE_LABELS.rascunho, dot: "var(--faint)" },
  { value: "suspenso", label: CONTRACT_STATE_LABELS.suspenso, dot: "var(--warning)" },
  { value: "encerrado", label: CONTRACT_STATE_LABELS.encerrado, dot: "var(--faint)" },
];

export default async function ContractsPage({ searchParams }: PageProps<"/contratos">) {
  const ctx = await requireOrgContext();
  const filters = contractFiltersSchema.parse(await searchParams);
  const contracts = await searchContracts(ctx.organization.id, filters);
  const totalMonthly = contracts.filter((c) => c.status === "ativo").reduce((a, c) => a + c.monthly_amount, 0);
  const canWrite = can(ctx.role, "finance:write");
  const vig = (c: (typeof contracts)[number]) => `${formatISODate(c.start_date)} ${c.end_date ? `a ${formatISODate(c.end_date)}` : "· indeterminado"}`;

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Contratos"
        description="Contratos de prestação de serviços com os clientes e seus honorários."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/contratos/servicos">
                <Tags /> Catálogo de serviços
              </Link>
            </Button>
            {canWrite && (
              <Button asChild>
                <Link href="/contratos/novo">
                  <Plus /> Novo contrato
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4">
          <StatusTabs basePath="/contratos" param="status" current={filters.status} options={TABS} keep={{ q: filters.q, status: filters.status }} />
          <SearchFilters placeholder="Pesquisar por número, cliente ou CNPJ…" />
        </div>
        {contracts.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title="Nenhum contrato encontrado"
            description="Cadastre o primeiro contrato ou ajuste os filtros."
            action={
              canWrite && (
                <Button asChild size="sm">
                  <Link href="/contratos/novo">
                    <Plus /> Novo contrato
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
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
                    <TableRow key={c.id} className="group">
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/contratos/${c.id}`} className="font-mono text-[13px] font-medium group-hover:text-primary">
                          {c.number}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {c.items_count} serviço(s) · venc. dia {c.billing_day}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-72">
                        <p className="truncate">{c.company?.corporate_name ?? "—"}</p>
                        {c.company && <p className="font-mono text-[11px] text-muted-foreground">{formatCnpj(c.company.cnpj)}</p>}
                      </TableCell>
                      <TableCell className="num whitespace-nowrap text-muted-foreground">{vig(c)}</TableCell>
                      <TableCell className="num text-right font-semibold whitespace-nowrap">{formatBRL(c.monthly_amount)}</TableCell>
                      <TableCell>
                        <ContractStateBadge status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {contracts.map((c) => (
                <li key={c.id}>
                  <Link href={`/contratos/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-subtle/70">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] font-medium">{c.number}</span>
                        <span className="num text-sm font-semibold">{formatBRL(c.monthly_amount)}</span>
                      </div>
                      <p className="truncate text-sm">{c.company?.corporate_name}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{vig(c)}</span>
                        <ContractStateBadge status={c.status} />
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground sm:px-5">
              {contracts.length} contrato(s) · mensalidades dos ativos listados:{" "}
              <strong className="num font-semibold text-foreground">{formatBRL(totalMonthly)}</strong>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
