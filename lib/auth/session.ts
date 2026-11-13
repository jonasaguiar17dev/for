import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { can, type Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationRow } from "@/types/database";
import type { OrgRole } from "@/types/domain";

export const ACTIVE_ORG_COOKIE = "aguiar_org";

export type SessionUser = { id: string; email: string };

export type Membership = {
  organization: OrganizationRow;
  role: OrgRole;
};

export type OrgContext = {
  user: SessionUser;
  organization: OrganizationRow;
  role: OrgRole;
  memberships: Membership[];
};

/** Usuário autenticado (JWT validado pelo Supabase) ou null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: String(data.claims.email ?? "") };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Vínculos ativos do usuário com organizações (consulta sob RLS). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw new Error("Não foi possível carregar as organizações do usuário.");
  if (!members?.length) return [];

  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .in(
      "id",
      members.map((m) => m.organization_id),
    )
    .order("name");
  if (orgError) throw new Error("Não foi possível carregar as organizações do usuário.");

  return (orgs ?? []).map((organization) => ({
    organization,
    role: members.find((m) => m.organization_id === organization.id)!.role,
  }));
});

/** Contexto da organização ativa (cookie validado contra os vínculos reais). */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const memberships = await getMemberships();
  if (!memberships.length) return null;

  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organization.id === preferred) ?? memberships[0];
  return { user, organization: active.organization, role: active.role, memberships };
});

/** Exige sessão e organização; redireciona para login/configuração inicial. */
export async function requireOrgContext(): Promise<OrgContext> {
  await requireUser();
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

/** Exige uma permissão da matriz; caso contrário, redireciona ao dashboard. */
export async function requirePermission(permission: Permission): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, permission)) redirect("/dashboard?erro=permissao");
  return ctx;
}
