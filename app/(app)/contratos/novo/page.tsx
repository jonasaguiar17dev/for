import type { Metadata } from "next";
import Link from "next/link";

import { ContractForm } from "@/components/finance/contract-form";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { requirePermission } from "@/lib/auth/session";
import { listClientOptions, listServices } from "@/services/finance";
import { todayISO } from "@/utils/dates";

export const metadata: Metadata = { title: "Novo contrato" };

export default async function NewContractPage({ searchParams }: PageProps<"/contratos/novo">) {
  const ctx = await requirePermission("finance:write");
  const { empresa } = await searchParams;
  const [clients, services] = await Promise.all([listClientOptions(ctx.organization.id), listServices(ctx.organization.id, true)]);
  const preset = typeof empresa === "string" && clients.some((c) => c.id === empresa) ? empresa : "";

  return (
    <>
      <PageHeader eyebrow="Contratos" title="Novo contrato" description="O número do contrato é gerado automaticamente." />
      {clients.length === 0 ? (
        <Alert>
          Cadastre um cliente antes de criar contratos.{" "}
          <Link href="/clientes/novo" className="font-medium text-primary hover:underline">
            Novo cliente
          </Link>
        </Alert>
      ) : (
        <ContractForm
          contractId={null}
          clients={clients}
          services={services}
          defaultValues={{
            company_id: preset,
            status: "ativo",
            start_date: todayISO(),
            end_date: "",
            billing_day: 10,
            adjustment_index: "nenhum",
            adjustment_month: "",
            notes: "",
            items: [{ id: "", service_id: "", description: "", quantity: "1", unit_amount: "", billing_frequency: "mensal" }],
          }}
        />
      )}
    </>
  );
}
