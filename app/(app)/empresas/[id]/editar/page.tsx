import type { Metadata } from "next";

import { EditCompanyPage } from "@/components/clients/edit-page";

export const metadata: Metadata = { title: "Editar empresa" };

export default async function EditCompanyRoute({ params }: PageProps<"/empresas/[id]/editar">) {
  const { id } = await params;
  return <EditCompanyPage id={id} mode="company" />;
}
