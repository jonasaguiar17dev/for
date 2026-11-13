"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { accountSchema, closePeriodSchema, journalEntrySchema } from "@/schemas/accounting";
import { uuidSchema } from "@/schemas/common";
import type { ActionResult } from "@/types/domain";
import { parentCode } from "@/utils/accounting";
import { friendlyDbError } from "@/utils/errors";
import { fieldErrors } from "@/utils/validation";

const DENIED = "Você não tem permissão para realizar esta operação.";

/** Contexto validado: papel com escrita contábil + empresa visível na organização ativa. */
async function writeContext(companyId: string) {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "finance:write")) return { error: DENIED } as const;
  if (!uuidSchema.safeParse(companyId).success) return { error: "Empresa inválida." } as const;
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (!company) return { error: DENIED } as const;
  return { ctx, supabase } as const;
}

const refresh = (companyId: string) => {
  revalidatePath("/contabilidade");
  revalidatePath(`/contabilidade/${companyId}`);
};

export async function setupChart(companyId: string): Promise<ActionResult<{ count: number }>> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  const { data, error } = await w.supabase.rpc("setup_chart_of_accounts", { p_company_id: companyId });
  if (error) return { ok: false, error: friendlyDbError(error) };
  refresh(companyId);
  return { ok: true, data: { count: Number(data) }, message: `Plano de contas criado com ${data} contas.` };
}

export async function saveAccount(companyId: string, accountId: string | null, input: unknown): Promise<ActionResult> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  if (accountId !== null && !uuidSchema.safeParse(accountId).success) return { ok: false, error: "Conta inválida." };
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  if (accountId) {
    // Código, grupo e tipo ficam travados após a criação (o banco também protege contas com movimento).
    const { error, count } = await w.supabase
      .from("accounts")
      .update({ name: v.name, nature: v.nature }, { count: "exact" })
      .eq("id", accountId)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: friendlyDbError(error) };
    if (!count) return { ok: false, error: DENIED };
  } else {
    const pc = parentCode(v.code);
    let parentId: string | null = null;
    if (pc) {
      const { data: parent } = await w.supabase.from("accounts").select("id").eq("company_id", companyId).eq("code", pc).maybeSingle();
      if (!parent) return { ok: false, error: `Cadastre antes a conta superior ${pc}.`, fieldErrors: { code: [`Conta ${pc} não existe`] } };
      parentId = parent.id;
    }
    const { error } = await w.supabase.from("accounts").insert({
      organization_id: w.ctx.organization.id,
      company_id: companyId,
      code: v.code,
      name: v.name,
      type: v.type,
      nature: v.nature,
      is_analytic: v.is_analytic,
      parent_id: parentId,
    });
    if (error) return { ok: false, error: friendlyDbError(error) };
  }
  refresh(companyId);
  return { ok: true, data: undefined, message: accountId ? "Conta atualizada." : "Conta criada." };
}

export async function setAccountActive(companyId: string, accountId: string, active: boolean): Promise<ActionResult> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  if (!uuidSchema.safeParse(accountId).success) return { ok: false, error: "Conta inválida." };
  const { error, count } = await w.supabase
    .from("accounts")
    .update({ active: Boolean(active) }, { count: "exact" })
    .eq("id", accountId)
    .eq("company_id", companyId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  refresh(companyId);
  return { ok: true, data: undefined, message: active ? "Conta reativada." : "Conta inativada." };
}

export async function deleteAccount(companyId: string, accountId: string): Promise<ActionResult> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  if (!uuidSchema.safeParse(accountId).success) return { ok: false, error: "Conta inválida." };
  const { error, count } = await w.supabase.from("accounts").delete({ count: "exact" }).eq("id", accountId).eq("company_id", companyId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  refresh(companyId);
  return { ok: true, data: undefined, message: "Conta excluída." };
}

export async function saveEntry(companyId: string, entryId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  if (entryId !== null && !uuidSchema.safeParse(entryId).success) return { ok: false, error: "Lançamento inválido." };
  const parsed = journalEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const { lines, ...entry } = parsed.data;
  const { data, error } = await w.supabase.rpc("save_journal_entry", {
    p_company_id: companyId,
    p_entry_id: entryId,
    p_entry: entry,
    p_lines: lines.map((l) => ({ account_id: l.account_id, debit: l.debit, credit: l.credit, memo: l.memo })),
  });
  if (error || !data) return { ok: false, error: friendlyDbError(error) };
  refresh(companyId);
  return { ok: true, data: { id: data }, message: entryId ? "Lançamento atualizado." : "Lançamento registrado." };
}

export async function deleteEntry(companyId: string, entryId: string): Promise<ActionResult> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  if (!uuidSchema.safeParse(entryId).success) return { ok: false, error: "Lançamento inválido." };
  const { error, count } = await w.supabase.from("journal_entries").delete({ count: "exact" }).eq("id", entryId).eq("company_id", companyId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  refresh(companyId);
  return { ok: true, data: undefined, message: "Lançamento excluído." };
}

/** Fecha (ou reabre) a escrituração até a data. Reabrir exige proprietário/administrador. */
export async function setClosedUntil(companyId: string, input: unknown): Promise<ActionResult> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  const parsed = closePeriodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data inválida." };
  const next = parsed.data.closed_until || null;

  const { data: current } = await w.supabase
    .from("accounting_settings")
    .select("closed_until")
    .eq("company_id", companyId)
    .maybeSingle();
  const reopening = current?.closed_until && (!next || next < current.closed_until);
  if (reopening && !can(w.ctx.role, "members:manage")) {
    return { ok: false, error: "Somente proprietário ou administrador pode reabrir um período fechado." };
  }
  const { error } = current
    ? await w.supabase.from("accounting_settings").update({ closed_until: next }).eq("company_id", companyId)
    : await w.supabase
        .from("accounting_settings")
        .insert({ company_id: companyId, organization_id: w.ctx.organization.id, closed_until: next });
  if (error) return { ok: false, error: friendlyDbError(error) };
  refresh(companyId);
  return { ok: true, data: undefined, message: next ? "Período fechado." : "Escrituração reaberta." };
}

