import type { Metadata } from "next";

import { CompanyDetailView } from "@/components/clients/company-detail-view";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientDetailPage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  return <CompanyDetailView id={id} section="clientes" />;
}
