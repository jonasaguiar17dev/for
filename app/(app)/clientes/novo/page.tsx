import type { Metadata } from "next";

import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewClientPage() {
  await requirePermission("company:create");
  return (
    <>
      <PageHeader
        eyebrow="Clientes"
        title="Novo cliente"
        description="Cadastre a empresa (CNPJ), o responsável e os contatos."
      />
      <ClientForm companyId={null} cancelHref="/clientes" />
    </>
  );
}
