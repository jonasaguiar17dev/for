import type { Metadata } from "next";

import { EditCompanyPage } from "@/components/clients/edit-page";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: PageProps<"/clientes/[id]/editar">) {
  const { id } = await params;
  return <EditCompanyPage id={id} mode="client" />;
}
