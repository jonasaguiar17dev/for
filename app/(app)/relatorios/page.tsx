import { Download } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrgContext } from "@/lib/auth/session";
import { getDashboardSummary } from "@/services/dashboard";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES, TAX_REGIME_LABELS, TAX_REGIMES } from "@/types/domain";

export const metadata: Metadata = { title: "Relatórios" };

function share(value: number, total: number) {
  return total ? `${((value / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";
}

export default async function ReportsPage() {
  const ctx = await requireOrgContext();
  const summary = await getDashboardSummary(ctx.organization.id);
  const totalClients = CONTRACT_STATUSES.reduce((acc, s) => acc + (summary.clients_by_status[s] ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Análises"
        title="Relatórios"
        description="Relatórios cadastrais com dados reais. Relatórios financeiros e contábeis virão com os próximos módulos."
        actions={
          <Button asChild>
            <a href="/relatorios/clientes.csv">
              <Download /> Carteira de clientes (CSV)
            </a>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clientes por situação</CardTitle>
            <CardDescription>{totalClients.toLocaleString("pt-BR")} clientes no total</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONTRACT_STATUSES.map((s) => {
                const v = summary.clients_by_status[s] ?? 0;
                return (
                  <TableRow key={s}>
                    <TableCell>{CONTRACT_STATUS_LABELS[s]}</TableCell>
                    <TableCell className="text-right tabular-nums">{v}</TableCell>
                    <TableCell className="text-right tabular-nums">{share(v, totalClients)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Empresas por regime tributário</CardTitle>
            <CardDescription>{summary.total_companies.toLocaleString("pt-BR")} empresas de clientes</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regime</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TAX_REGIMES.map((r) => {
                const v = summary.companies_by_regime[r] ?? 0;
                return (
                  <TableRow key={r}>
                    <TableCell>{TAX_REGIME_LABELS[r]}</TableCell>
                    <TableCell className="text-right tabular-nums">{v}</TableCell>
                    <TableCell className="text-right tabular-nums">{share(v, summary.total_companies)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
      <CardContent className="px-0 text-xs text-muted-foreground">
        Todos os números respeitam suas permissões de acesso (RLS): você vê apenas as empresas autorizadas.
      </CardContent>
    </>
  );
}
