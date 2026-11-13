import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContractActions } from "@/components/finance/contract-actions";
import { ReceivablesTable } from "@/components/finance/receivables-table";
import { ContractStateBadge } from "@/components/finance/status-badges";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { uuidSchema } from "@/schemas/common";
import { getContractDetail } from "@/services/finance";
import { ADJUSTMENT_INDEX_LABELS, BILLING_FREQUENCY_LABELS, MONTH_LABELS } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatISODate, todayISO } from "@/utils/dates";
import { formatDateTime } from "@/utils/format";
import { formatBRL, sumItems } from "@/utils/money";

export const metadata: Metadata = { title: "Contrato" };

const FIELD: Record<string, string> = {
  status: "Situação",
  start_date: "Início",
  end_date: "Término",
  billing_day: "Dia de vencimento",
  adjustment_index: "Reajuste",
  adjustment_month: "Mês do reajuste",
  notes: "Observações",
  description: "Descrição",
  quantity: "Quantidade",
  unit_amount: "Valor unitário",
  billing_frequency: "Periodicidade",
};

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm">{children || "—"}</dd>
    </div>
  );
}

export default async function ContractPage({ params }: PageProps<"/contratos/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const detail = await getContractDetail(id, ctx.organization.id);
  if (!detail) notFound();
  const { contract: c, company, items, receivables, history } = detail;
  const canWrite = can(ctx.role, "finance:write");
  const monthly = sumItems(items.filter((i) => i.billing_frequency === "mensal"));
  const today = todayISO();

  return (
    <>
      <Link href="/contratos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para contratos
      </Link>
      <PageHeader
        eyebrow="Contrato"
        title={c.number}
        description={
          <Link href={`/clientes/${company.id}`} className="hover:text-primary">
            {company.corporate_name} · <span className="tabular-nums">{formatCnpj(company.cnpj)}</span>
          </Link>
        }
        actions={
          canWrite && (
            <>
              <Button asChild>
                <Link href={`/contratos/${c.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
              <ContractActions contractId={c.id} status={c.status} canDelete={can(ctx.role, "company:delete")} />
            </>
          )
        }
      />
      <div className="mb-6">
        <ContractStateBadge status={c.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent>
            <dl className="grid gap-5">
              <Item label="Vigência">
                {formatISODate(c.start_date)} {c.end_date ? `a ${formatISODate(c.end_date)}` : "· prazo indeterminado"}
              </Item>
              <Item label="Vencimento">Todo dia {c.billing_day}</Item>
              <Item label="Reajuste">
                {ADJUSTMENT_INDEX_LABELS[c.adjustment_index]}
                {c.adjustment_month ? ` · em ${MONTH_LABELS[c.adjustment_month - 1]}` : ""}
              </Item>
              <Item label="Mensalidade">
                <span className="num text-2xl font-semibold tracking-tight">{formatBRL(monthly)}</span>
              </Item>
              <Item label="Observações">
                <span className="whitespace-pre-line">{c.notes}</span>
              </Item>
            </dl>
          </CardContent>
        </Card>
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle>Serviços</CardTitle>
          </CardHeader>
          <div className="hidden border-t border-border sm:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Descrição</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead className="text-right">Qtde</TableHead>
                  <TableHead className="text-right">Unitário</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.description}</TableCell>
                    <TableCell className="text-muted-foreground">{BILLING_FREQUENCY_LABELS[i.billing_frequency]}</TableCell>
                    <TableCell className="num text-right">{i.quantity.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="num text-right">{formatBRL(i.unit_amount)}</TableCell>
                    <TableCell className="num text-right font-medium">{formatBRL(sumItems([i]))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y divide-border border-t border-border sm:hidden">
            {items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">{i.description}</p>
                  <p className="num text-xs text-muted-foreground">
                    {BILLING_FREQUENCY_LABELS[i.billing_frequency]} · {i.quantity.toLocaleString("pt-BR")} × {formatBRL(i.unit_amount)}
                  </p>
                </div>
                <p className="num shrink-0 text-sm font-medium">{formatBRL(sumItems([i]))}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Cobranças deste contrato</CardTitle>
          <CardDescription>Geradas em Financeiro › Gerar faturamento.</CardDescription>
        </CardHeader>
        <div className="mt-4 border-t border-border">
          <ReceivablesTable
            canWrite={canWrite}
            showCompany={false}
            rows={receivables.map((r) => ({
              ...r,
              contract_number: c.number,
              is_overdue: r.status === "aberto" && r.due_date < today,
            }))}
          />
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
          ) : (
            <ol className="grid gap-4 border-l pl-5">
              {history.map((h) => {
                const ch = (h.changes ?? {}) as Record<string, { old?: unknown; new?: unknown }>;
                const what = h.entity === "contracts" ? "contrato" : "serviço do contrato";
                const verb = { insert: "criou", update: "alterou", delete: "excluiu" }[h.action];
                const fields = h.action === "update" ? Object.entries(ch).filter(([k]) => FIELD[k]) : [];
                return (
                  <li key={h.id} className="text-sm">
                    <p>
                      <strong>{h.author ?? "Sistema"}</strong> {verb} {what}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
                    {fields.length > 0 && (
                      <ul className="mt-1 grid gap-0.5 rounded-md bg-muted/60 p-2 text-xs">
                        {fields.map(([k, d]) => (
                          <li key={k}>
                            <span className="font-medium">{FIELD[k]}:</span>{" "}
                            <span className="text-muted-foreground line-through">{String(d?.old ?? "—")}</span> → {String(d?.new ?? "—")}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}
