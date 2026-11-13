import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContractForm } from "@/components/finance/contract-form";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/session";
import { uuidSchema } from "@/schemas/common";
import { getContractDetail, listClientOptions, listServices } from "@/services/finance";
import { formatMoneyInput } from "@/utils/money";

export const metadata: Metadata = { title: "Editar contrato" };

export default async function EditContractPage({ params }: PageProps<"/contratos/[id]/editar">) {
  const ctx = await requirePermission("finance:write");
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [detail, clients, services] = await Promise.all([
    getContractDetail(id, ctx.organization.id),
    listClientOptions(ctx.organization.id),
    listServices(ctx.organization.id),
  ]);
  if (!detail) notFound();
  const c = detail.contract;

  return (
    <>
      <PageHeader eyebrow="Editar contrato" title={`${c.number} · ${detail.company.corporate_name}`} />
      <ContractForm
        contractId={c.id}
        clients={clients.some((x) => x.id === detail.company.id) ? clients : [detail.company, ...clients]}
        services={services}
        defaultValues={{
          company_id: c.company_id,
          status: c.status,
          start_date: c.start_date,
          end_date: c.end_date ?? "",
          billing_day: c.billing_day,
          adjustment_index: c.adjustment_index,
          adjustment_month: c.adjustment_month ?? "",
          notes: c.notes ?? "",
          items: detail.items.map((i) => ({
            id: i.id,
            service_id: i.service_id ?? "",
            description: i.description,
            quantity: String(i.quantity).replace(".", ","),
            unit_amount: formatMoneyInput(i.unit_amount),
            billing_frequency: i.billing_frequency,
          })),
        }}
      />
    </>
  );
}
