import type { Metadata } from "next";

import { CompanyDetailView } from "@/components/clients/company-detail-view";

export const metadata: Metadata = { title: "Empresa" };

export default async function CompanyDetailPage({ params }: PageProps<"/empresas/[id]">) {
  const { id } = await params;
  return <CompanyDetailView id={id} section="empresas" />;
}
