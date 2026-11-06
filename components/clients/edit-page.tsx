import { notFound } from "next/navigation";

import { ClientForm } from "@/components/clients/client-form";
import { toClientFormValues } from "@/components/clients/form-values";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { requireOrgContext } from "@/lib/auth/session";
import { canEditCompany } from "@/lib/permissions";
import { uuidSchema } from "@/schemas/common";
import { getCompanyDetail } from "@/services/companies";

/** Página de edição compartilhada por /clientes/[id]/editar e /empresas/[id]/editar. */
export async function EditCompanyPage({ id, mode }: { id: string; mode: "client" | "company" }) {
  const ctx = await requireOrgContext();
  if (!uuidSchema.safeParse(id).success) notFound();
  const detail = await getCompanyDetail(id, ctx.organization.id);
  if (!detail) notFound();

  const myAccess = detail.access.find((a) => a.user_id === ctx.user.id)?.role;
  const base = mode === "client" ? "/clientes" : "/empresas";
  // O CNPJ interno não é cliente: edita-se somente como empresa.
  const effectiveMode = detail.company.is_internal ? "company" : mode;

  return (
    <>
      <PageHeader eyebrow="Editar cadastro" title={detail.company.corporate_name} />
      {canEditCompany(ctx.role, myAccess) ? (
        <ClientForm
          companyId={detail.company.id}
          mode={effectiveMode}
          defaultValues={toClientFormValues(detail.company, detail.client, detail.contacts)}
          cancelHref={`${base}/${detail.company.id}`}
        />
      ) : (
        <Alert variant="destructive">Você não tem permissão para editar esta empresa.</Alert>
      )}
    </>
  );
}
