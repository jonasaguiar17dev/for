import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrganizationMemberRow, ProfileRow } from "@/types/database";

export type MemberEntry = OrganizationMemberRow & { profile: Pick<ProfileRow, "full_name" | "email"> | null };

export async function listOrganizationMembers(organizationId: string): Promise<MemberEntry[]> {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at");
  if (error) throw new Error("Não foi possível carregar os membros.");

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as Pick<ProfileRow, "id" | "full_name" | "email">[] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (members ?? []).map((m) => {
    const p = byId.get(m.user_id);
    return { ...m, profile: p ? { full_name: p.full_name, email: p.email } : null };
  });
}

export async function getInternalCompanyId(organizationId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_internal", true)
    .maybeSingle();
  return data?.id ?? null;
}
