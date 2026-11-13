import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntryForm } from "@/components/accounting/entry-form";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/session";
import { uuidSchema } from "@/schemas/common";
import { getAccountingCompany, listAccounts } from "@/services/accounting";
import { todayISO } from "@/utils/dates";

export const metadata: Metadata = { title: "Novo lançamento" };

export default async function NewEntryPage({ params }: PageProps<"/contabilidade/[empresa]/lancamentos/novo">) {
  const ctx = await requirePermission("finance:write");
  const { empresa } = await params;
  if (!uuidSchema.safeParse(empresa).success) notFound();
  const company = await getAccountingCompany(ctx.organization.id, empresa);
  if (!company?.has_chart) notFound();
  const accounts = (await listAccounts(company.id)).filter((a) => a.is_analytic && a.active);
  const line = { account_id: "", debit: "", credit: "", memo: "" };

  return (
    <>
      <PageHeader eyebrow={`Contabilidade · ${company.corporate_name}`} title="Novo lançamento" />
      <EntryForm
        companyId={company.id}
        entryId={null}
        accounts={accounts}
        closedUntil={company.closed_until}
        defaultValues={{ entry_date: todayISO(), description: "", lines: [line, { ...line }] }}
      />
    </>
  );
}
