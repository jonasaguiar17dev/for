"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/schemas/common";
import { competenceSchema, paymentSchema, receivableSchema } from "@/schemas/finance";
import type { ReceivableRow } from "@/types/database";
import type { ActionResult } from "@/types/domain";
import { formatCompetence } from "@/utils/dates";
import { friendlyDbError } from "@/utils/errors";
import { fieldErrors } from "@/utils/validation";

const DENIED = "Você não tem permissão para realizar esta operação.";

function revalidateFinance() {
  revalidatePath("/financeiro");
  revalidatePath("/contratos", "layout");
  revalidatePath("/dashboard");
}

export async function generateBilling(competence: string): Promise<ActionResult<{ created: number }>> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "finance:write")) return { ok: false, error: DENIED };
  const parsed = competenceSchema.safeParse(competence);
  if (!parsed.success) return { ok: false, error: "Competência inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_billing", {
    p_organization_id: ctx.organization.id,
    p_competence: parsed.data,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidateFinance();
  const created = Number(data ?? 0);
  return {
    ok: true,
    data: { created },
    message: created
      ? `${created} cobrança(s) gerada(s) para ${formatCompetence(parsed.data)}.`
      : `Nenhuma cobrança nova para ${formatCompetence(parsed.data)}: tudo já estava faturado.`,
  };
}

export async function createReceivable(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "finance:write")) return { ok: false, error: DENIED };
  const parsed = receivableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("receivables").insert({
    ...parsed.data,
    notes: parsed.data.notes || null,
    organization_id: ctx.organization.id,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidateFinance();
  return { ok: true, data: undefined, message: "Cobrança lançada." };
}

async function updateReceivable(id: string, patch: Partial<ReceivableRow>, message: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "finance:write")) return { ok: false, error: DENIED };
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Cobrança inválida." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("receivables")
    .update(patch, { count: "exact" })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  revalidateFinance();
  return { ok: true, data: undefined, message };
}

export async function registerPayment(id: string, input: unknown): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos.", fieldErrors: fieldErrors(parsed.error) };
  return updateReceivable(id, { status: "pago", ...parsed.data }, "Pagamento registrado.");
}

export async function undoPayment(id: string): Promise<ActionResult> {
  return updateReceivable(id, { status: "aberto", paid_at: null, paid_amount: null, payment_method: null }, "Pagamento estornado.");
}

export async function cancelReceivable(id: string): Promise<ActionResult> {
  return updateReceivable(id, { status: "cancelado", paid_at: null, paid_amount: null, payment_method: null }, "Cobrança cancelada.");
}
