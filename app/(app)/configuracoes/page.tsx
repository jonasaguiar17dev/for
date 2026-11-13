import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { listOrganizationMembers } from "@/services/organization";
import { ORG_ROLE_DESCRIPTIONS, ORG_ROLE_LABELS, ORG_ROLES } from "@/types/domain";
import { formatPhone } from "@/utils/format";

import { MembersManager } from "./members-manager";
import { OrganizationForm, ProfileForm } from "./settings-forms";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const [members, { data: profile }] = await Promise.all([
    listOrganizationMembers(ctx.organization.id),
    supabase.from("profiles").select("full_name, phone").eq("id", ctx.user.id).maybeSingle(),
  ]);
  const canManage = can(ctx.role, "members:manage");

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Organização, usuários e permissões." />
      <div className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Organização</CardTitle>
              <CardDescription>Identificador: {ctx.organization.slug}</CardDescription>
            </CardHeader>
            <CardContent>
              <OrganizationForm name={ctx.organization.name} canEdit={can(ctx.role, "organization:update")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Meu perfil</CardTitle>
              <CardDescription>{ctx.user.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm fullName={profile?.full_name ?? ""} phone={formatPhone(profile?.phone)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários e permissões</CardTitle>
            <CardDescription>
              Para incluir alguém, crie primeiro o usuário em Supabase › Authentication › Users (convite por e-mail) e
              depois adicione-o aqui pelo e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembersManager members={members} actorRole={ctx.role} actorId={ctx.user.id} canManage={canManage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Papéis disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ORG_ROLES.map((r) => (
                <div key={r} className="rounded-lg border p-4">
                  <dt className="font-medium">{ORG_ROLE_LABELS[r]}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{ORG_ROLE_DESCRIPTIONS[r]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
