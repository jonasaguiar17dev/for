import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SearchCompaniesRow } from "@/types/database";
import { TAX_REGIME_LABELS } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatDate } from "@/utils/format";

import { CompanyStatusBadge, ContractStatusBadge } from "./status-badges";

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-subtle text-[11px] font-semibold text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Tabela de clientes/empresas com versão em cartões para telas pequenas. */
export function CompaniesTable({
  rows,
  hrefBase,
  mode,
}: {
  rows: SearchCompaniesRow[];
  hrefBase: "/clientes" | "/empresas";
  mode: "clients" | "companies";
}) {
  if (rows.length === 0) {
    return <EmptyState icon={Building2} title="Nenhum registro encontrado" description="Ajuste a pesquisa ou os filtros." />;
  }
  const status = (row: SearchCompaniesRow) =>
    mode === "clients" ? <ContractStatusBadge status={row.contract_status} /> : <CompanyStatusBadge status={row.company_status} />;

  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.company_id} className="group">
                <TableCell className="max-w-80">
                  <Link href={`${hrefBase}/${row.company_id}`} className="flex items-center gap-3 focus-visible:outline-none">
                    <Avatar name={row.corporate_name} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium group-hover:text-primary">{row.corporate_name}</span>
                        {row.is_internal && <Badge variant="dark">Interno</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{row.trade_name || "—"}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-[12.5px] whitespace-nowrap text-foreground/80">{formatCnpj(row.cnpj)}</TableCell>
                <TableCell className="whitespace-nowrap">{TAX_REGIME_LABELS[row.tax_regime]}</TableCell>
                <TableCell className="max-w-44 truncate">{row.responsible_name || "—"}</TableCell>
                <TableCell>{status(row)}</TableCell>
                <TableCell className="num text-right whitespace-nowrap text-muted-foreground">{formatDate(row.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border lg:hidden">
        {rows.map((row) => (
          <li key={row.company_id}>
            <Link href={`${hrefBase}/${row.company_id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle/70">
              <Avatar name={row.corporate_name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{row.corporate_name}</p>
                  {status(row)}
                </div>
                <p className="mt-0.5 truncate font-mono text-[11.5px] text-muted-foreground">
                  {formatCnpj(row.cnpj)} · {TAX_REGIME_LABELS[row.tax_regime]}
                </p>
                {row.responsible_name && <p className="truncate text-xs text-muted-foreground">Resp.: {row.responsible_name}</p>}
              </div>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
