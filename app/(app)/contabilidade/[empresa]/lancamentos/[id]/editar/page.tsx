import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntryForm } from "@/components/accounting/entry-form";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/session";
import { uuidSchema } from "@/schemas/common";
import { getAccountingCompany, getEntry, listAccounts } from "@/services/accounting";
import { formatMoneyInput } from "@/utils/money";

export const metadata: Metadata = { title: "Editar lançamento" };

export default async function EditEntryPage({ params }: PageProps<"/contabilidade/[empresa]/lancamentos/[id]/editar">) {
  const ctx = await requirePermission("finance:write");
  const { empresa, id } = await params;
  if (!uuidSchema.safeParse(empresa).success || !uuidSchema.safeParse(id).success) notFound();
  const company = await getAccountingCompany(ctx.organization.id, empresa);
  if (!company) notFound();
  const [entry, all] = await Promise.all([getEntry(company.id, id), listAccounts(company.id)]);
  if (!entry) notFound();
  const used = new Set(entry.lines.map((l) => l.account_id));
  // Contas inativas já usadas continuam disponíveis para não "perder" a partida na edição.
  const accounts = all.filter((a) => a.is_analytic && (a.active || used.has(a.id)));

  return (
    <>
      <PageHeader eyebrow={`Contabilidade · ${company.corporate_name}`} title={`Lançamento nº ${entry.number}`} />
      <EntryForm
        companyId={company.id}
        entryId={entry.id}
        accounts={accounts}
        closedUntil={company.closed_until}
        defaultValues={{
          entry_date: entry.entry_date,
          description: entry.description,
          lines: entry.lines.map((l) => ({
            account_id: l.account_id,
            debit: l.debit ? formatMoneyInput(l.debit) : "",
            credit: l.credit ? formatMoneyInput(l.credit) : "",
            memo: l.memo ?? "",
          })),
        }}
      />
    </>
  );
}
