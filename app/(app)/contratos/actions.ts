"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/schemas/common";
import { contractFormSchema, serviceSchema, toContractPayload } from "@/schemas/finance";
import { CONTRACT_STATES, type ActionResult } from "@/types/domain";
import { friendlyDbError } from "@/utils/errors";
import { fieldErrors } from "@/utils/validation";

const DENIED = "Você não tem permissão para realizar esta operação.";

function revalidateFinance(contractId?: string) {
  revalidatePath("/contratos");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  if (contractId) revalidatePath(`/contratos/${contractId}`);
}

export async function saveContract(contractId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "finance:write")) return { ok: false, error: DENIED };
  if (contractId !== null && !uuidSchema.safeParse(contractId).success) return { ok: false, error: "Contrato inválido." };

  const parsed = contractFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { contract, items } = toContractPayload(parsed.data);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_contract", {
    p_organization_id: ctx.organization.id,
    p_contract_id: contractId,
    p_contract: contract,
    p_items: items,
  });
  if (error || !data) return { ok: false, error: friendlyDbError(error) };

  revalidateFinance(data);
  return { ok: true, data: { id: data }, message: contractId ? "Contrato atualizado." : "Contrato criado." };
}

export async function changeContractStatus(contractId: string, status: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "finance:write")) return { ok: false, error: DENIED };
  const parsed = z.object({ id: uuidSchema, status: z.enum(CONTRACT_STATES) }).safeParse({ id: contractId, status });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("contracts")
    .update({ status: parsed.data.status }, { count: "exact" })
    .eq("id", parsed.data.id)
    .eq("organization_id", ctx.organization.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  revalidateFinance(contractId);
  return { ok: true, data: undefined, message: "Situação do contrato atualizada." };
}

export async function deleteContract(contractId: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "company:delete")) return { ok: false, error: DENIED };
  if (!uuidSchema.safeParse(contractId).success) return { ok: false, error: "Contrato inválido." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("contracts")
    .delete({ count: "exact" })
    .eq("id", contractId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  revalidateFinance();
  redirect("/contratos");
}

export async function saveService(serviceId: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "services:manage")) return { ok: false, error: DENIED };
  if (serviceId !== null && !uuidSchema.safeParse(serviceId).success) return { ok: false, error: "Serviço inválido." };
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const payload = { ...parsed.data, description: parsed.data.description || null };
  const { error } = serviceId
    ? await supabase.from("services").update(payload).eq("id", serviceId).eq("organization_id", ctx.organization.id)
    : await supabase.from("services").insert({ ...payload, organization_id: ctx.organization.id });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um serviço com este nome." };
    return { ok: false, error: friendlyDbError(error) };
  }
  revalidatePath("/contratos/servicos");
  return { ok: true, data: undefined, message: serviceId ? "Serviço atualizado." : "Serviço criado." };
}

export async function deleteService(serviceId: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "services:manage")) return { ok: false, error: DENIED };
  if (!uuidSchema.safeParse(serviceId).success) return { ok: false, error: "Serviço inválido." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("services")
    .delete({ count: "exact" })
    .eq("id", serviceId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  revalidatePath("/contratos/servicos");
  return { ok: true, data: undefined, message: "Serviço excluído. Contratos existentes não são alterados." };
}
