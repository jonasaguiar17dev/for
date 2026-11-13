import { BookOpenCheck, Building2, ChevronRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgContext } from "@/lib/auth/session";
import { listAccountingCompanies } from "@/services/accounting";
import { formatCnpj } from "@/utils/cnpj";
import { formatISODate } from "@/utils/dates";

export const metadata: Metadata = { title: "Contabilidade" };

export default async function AccountingPage({ searchParams }: PageProps<"/contabilidade">) {
  const ctx = await requireOrgContext();
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim().toLowerCase() : "";
  const all = await listAccountingCompanies(ctx.organization.id);
  const companies = term
    ? all.filter(
        (c) =>
          c.corporate_name.toLowerCase().includes(term) ||
          (c.trade_name ?? "").toLowerCase().includes(term) ||
          c.cnpj.includes(term.toUpperCase().replace(/[^0-9A-Z]/g, "") || "§"),
      )
    : all;
  const withChart = all.filter((c) => c.has_chart).length;

  return (
    <>
      <PageHeader
        eyebrow="Contábil"
        title="Contabilidade"
        description="Escrituração por empresa: plano de contas, lançamentos em partidas dobradas, balancete, DRE, balanço e fechamento de período."
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <form method="get" className="w-full sm:max-w-sm">
            <input
              name="q"
              defaultValue={typeof q === "string" ? q : ""}
              placeholder="Pesquisar empresa por nome ou CNPJ…"
              aria-label="Pesquisar empresa"
              className="h-9 w-full rounded-lg border border-border-strong bg-card px-3 text-sm"
            />
          </form>
          <p className="text-[13px] text-muted-foreground">
            {withChart} de {all.length} empresa(s) com escrituração iniciada
          </p>
        </div>
        {companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma empresa encontrada"
            description={all.length ? "Ajuste a pesquisa." : "Cadastre empresas para iniciar a escrituração."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {companies.map((c) => (
              <li key={c.id}>
                <Link href={`/contabilidade/${c.id}`} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-subtle/70 sm:px-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                    <BookOpenCheck className={c.has_chart ? "size-[18px] text-primary" : "size-[18px] text-faint"} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium group-hover:text-primary">
                      {c.corporate_name}
                      {c.is_internal && <span className="ml-2 text-xs font-normal text-muted-foreground">(escritório)</span>}
                    </p>
                    <p className="font-mono text-[11.5px] text-muted-foreground">{formatCnpj(c.cnpj)}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    {c.has_chart ? <Badge variant="success" dot>Escrituração ativa</Badge> : <Badge variant="neutral" dot>Sem plano de contas</Badge>}
                    {c.closed_until && (
                      <Badge variant="outline">
                        <Lock className="size-3" /> até {formatISODate(c.closed_until)}
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
