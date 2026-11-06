"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrgContext } from "@/lib/auth/session";
import { can, canAssignRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { phoneSchema, uuidSchema } from "@/schemas/common";
import { addMemberSchema } from "@/schemas/organization";
import { MEMBER_STATUSES, ORG_ROLES, type ActionResult } from "@/types/domain";
import { friendlyDbError } from "@/utils/errors";
import { fieldErrors } from "@/utils/validation";

const DENIED = "Você não tem permissão para realizar esta operação.";

export async function addMember(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos.", fieldErrors: fieldErrors(parsed.error) };
  if (!canAssignRole(ctx.role, parsed.data.role)) return { ok: false, error: DENIED };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_organization_member", {
    p_organization_id: ctx.organization.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/configuracoes");
  return { ok: true, data: undefined, message: "Membro adicionado." };
}

const updateMemberSchema = z.object({
  memberId: uuidSchema,
  role: z.enum(ORG_ROLES).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
});

export async function updateMember(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "members:manage")) return { ok: false, error: DENIED };
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const { memberId, role, status } = parsed.data;
  if (role && !canAssignRole(ctx.role, role)) return { ok: false, error: DENIED };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("organization_members")
    .update({ ...(role ? { role } : {}), ...(status ? { status } : {}) }, { count: "exact" })
    .eq("id", memberId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  revalidatePath("/configuracoes");
  return { ok: true, data: undefined, message: "Membro atualizado." };
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "members:manage")) return { ok: false, error: DENIED };
  if (!uuidSchema.safeParse(memberId).success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("organization_members")
    .delete({ count: "exact" })
    .eq("id", memberId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  revalidatePath("/configuracoes");
  return { ok: true, data: undefined, message: "Membro removido." };
}

const organizationSchema = z.object({ name: z.string().trim().min(2, "Informe o nome").max(160) });

export async function updateOrganization(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "organization:update")) return { ok: false, error: DENIED };
  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ name: parsed.data.name }).eq("id", ctx.organization.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined, message: "Organização atualizada." };
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(160),
  phone: phoneSchema,
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/configuracoes");
  return { ok: true, data: undefined, message: "Perfil atualizado." };
}
