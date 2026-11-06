import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireOrgContext } from "@/lib/auth/session";
import { can, canEditCompany } from "@/lib/permissions";
import { uuidSchema } from "@/schemas/common";
import { getCompanyDetail } from "@/services/companies";
import { TAX_REGIME_LABELS } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { formatCep, formatCnae, formatDate, formatPhone } from "@/utils/format";

import { AuditTimeline } from "./audit-timeline";
import { CompanyAccessPanel } from "./company-access-panel";
import { DeleteCompanyButton } from "./delete-company-button";
import { DocumentsPanel } from "./documents-panel";
import { CompanyStatusBadge, ContractStatusBadge, OnboardingStatusBadge } from "./status-badges";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm break-words">{children || "—"}</dd>
    </div>
  );
}

/** Visualização individual de empresa/cliente com abas. */
export async function CompanyDetailView({ id, section }: { id: string; section: "clientes" | "empresas" }) {
  const ctx = await requireOrgContext();
  if (!uuidSchema.safeParse(id).success) notFound();
  const detail = await getCompanyDetail(id, ctx.organization.id);
  if (!detail) notFound();

  const { company, client, contacts, documents, history, access } = detail;
  const myCompanyRole = access.find((a) => a.user_id === ctx.user.id)?.role;
  const canWrite = canEditCompany(ctx.role, myCompanyRole);
  const canManage = can(ctx.role, "members:manage");
  const a = company.address ?? {};
  const address = [
    [a.street, a.number].filter(Boolean).join(", "),
    a.complement,
    a.district,
    [a.city, a.state].filter(Boolean).join("/"),
    a.cep && `CEP ${formatCep(a.cep)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const editHref = company.is_internal || section === "empresas" ? `/empresas/${company.id}/editar` : `/clientes/${company.id}/editar`;

  return (
    <>
      <Link
        href={`/${section}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para {section === "clientes" ? "clientes" : "empresas"}
      </Link>
      <PageHeader
        eyebrow={company.is_internal ? "CNPJ interno" : client ? "Cliente" : "Empresa"}
        title={company.corporate_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular-nums">{formatCnpj(company.cnpj)}</span>
            {company.trade_name && <span>· {company.trade_name}</span>}
          </span>
        }
        actions={
          <>
            {canWrite && (
              <Button asChild>
                <Link href={editHref}>
                  <Pencil /> Editar
                </Link>
              </Button>
            )}
            {can(ctx.role, "company:delete") && !company.is_internal && (
              <DeleteCompanyButton companyId={company.id} cnpj={company.cnpj} />
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {company.is_internal && <Badge variant="dark">Gestão interna</Badge>}
        <CompanyStatusBadge status={company.status} />
        {client && <ContractStatusBadge status={client.contract_status} />}
        {client && <OnboardingStatusBadge status={client.onboarding_status} />}
        <Badge variant="outline">{TAX_REGIME_LABELS[company.tax_regime]}</Badge>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados cadastrais</TabsTrigger>
          <TabsTrigger value="contatos">Contatos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="acessos">Acessos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Item label="Razão social">{company.corporate_name}</Item>
                  <Item label="Nome fantasia">{company.trade_name}</Item>
                  <Item label="CNPJ">{formatCnpj(company.cnpj)}</Item>
                  <Item label="Regime tributário">{TAX_REGIME_LABELS[company.tax_regime]}</Item>
                  <Item label="CNAE principal">{company.cnae && formatCnae(company.cnae)}</Item>
                  <Item label="Situação cadastral">
                    <CompanyStatusBadge status={company.status} />
                  </Item>
                  <Item label="Inscrição estadual">{company.state_registration}</Item>
                  <Item label="Inscrição municipal">{company.municipal_registration}</Item>
                  <div className="sm:col-span-2">
                    <Item label="Endereço">{address}</Item>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                {client ? (
                  <dl className="grid gap-5">
                    <Item label="Responsável">{client.responsible_name}</Item>
                    <Item label="E-mail">
                      {client.email && (
                        <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                          {client.email}
                        </a>
                      )}
                    </Item>
                    <Item label="Telefone">{client.phone && formatPhone(client.phone)}</Item>
                    <Item label="Cliente desde">{formatDate(client.created_at)}</Item>
                    <Item label="Observações">
                      <span className="whitespace-pre-line">{client.notes}</span>
                    </Item>
                  </dl>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {company.is_internal
                      ? "CNPJ próprio da organização, usado para a gestão interna."
                      : "Esta empresa ainda não possui cadastro de cliente."}
                    {!company.is_internal && canWrite && (
                      <Button asChild variant="link" className="px-0">
                        <Link href={`/clientes/${company.id}/editar`}>Cadastrar como cliente</Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contatos">
          <Card>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {contacts.map((c) => (
                    <li key={c.id} className="rounded-lg border p-4">
                      <p className="font-medium">{c.name}</p>
                      {c.position && <p className="text-xs text-muted-foreground">{c.position}</p>}
                      <div className="mt-2 grid gap-0.5 text-sm">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="truncate text-primary hover:underline">
                            {c.email}
                          </a>
                        )}
                        {c.phone && <span>{formatPhone(c.phone)}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardContent>
              <DocumentsPanel companyId={company.id} documents={documents} canWrite={canWrite} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acessos">
          <Card>
            <CardContent>
              <CompanyAccessPanel companyId={company.id} access={access} canManage={canManage} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent>
              <AuditTimeline entries={history} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
