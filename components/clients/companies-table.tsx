import { Building2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SearchCompaniesRow } from "@/types/database";
import { TAX_REGIME_LABELS } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatDate } from "@/utils/format";

import { CompanyStatusBadge, ContractStatusBadge } from "./status-badges";

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
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Building2 className="size-8 text-muted-foreground" />
        <p className="font-medium">Nenhum registro encontrado</p>
        <p className="text-sm text-muted-foreground">Ajuste a pesquisa ou os filtros.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Razão social</TableHead>
              <TableHead>Nome fantasia</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.company_id}>
                <TableCell className="max-w-72">
                  <Link
                    href={`${hrefBase}/${row.company_id}`}
                    className="line-clamp-2 font-medium hover:text-primary focus-visible:underline focus-visible:outline-none"
                  >
                    {row.corporate_name}
                  </Link>
                  {row.is_internal && (
                    <Badge variant="dark" className="mt-1">
                      CNPJ interno
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">{row.trade_name || "—"}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatCnpj(row.cnpj)}</TableCell>
                <TableCell className="whitespace-nowrap">{TAX_REGIME_LABELS[row.tax_regime]}</TableCell>
                <TableCell className="max-w-40 truncate">{row.responsible_name || "—"}</TableCell>
                <TableCell>
                  {mode === "clients" ? (
                    <ContractStatusBadge status={row.contract_status} />
                  ) : (
                    <CompanyStatusBadge status={row.company_status} />
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatDate(row.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y md:hidden">
        {rows.map((row) => (
          <li key={row.company_id}>
            <Link href={`${hrefBase}/${row.company_id}`} className="block px-4 py-3 hover:bg-accent/40">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{row.corporate_name}</p>
                {mode === "clients" ? (
                  <ContractStatusBadge status={row.contract_status} />
                ) : (
                  <CompanyStatusBadge status={row.company_status} />
                )}
              </div>
              {row.trade_name && <p className="text-sm text-muted-foreground">{row.trade_name}</p>}
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {formatCnpj(row.cnpj)} · {TAX_REGIME_LABELS[row.tax_regime]} · {formatDate(row.created_at)}
              </p>
              {row.responsible_name && <p className="text-xs text-muted-foreground">Resp.: {row.responsible_name}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
