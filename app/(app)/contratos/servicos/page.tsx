import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ServicesManager } from "@/components/finance/services-manager";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listServices } from "@/services/finance";

export const metadata: Metadata = { title: "Catálogo de serviços" };

export default async function ServicesPage() {
  const ctx = await requireOrgContext();
  const services = await listServices(ctx.organization.id);
  return (
    <>
      <Link href="/contratos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para contratos
      </Link>
      <PageHeader
        eyebrow="Contratos"
        title="Catálogo de serviços"
        description="Serviços e honorários padrão, usados para preencher os contratos. Alterar o catálogo não muda contratos já firmados."
      />
      <Card>
        <CardContent>
          <ServicesManager services={services} canManage={can(ctx.role, "services:manage")} />
        </CardContent>
      </Card>
    </>
  );
}
