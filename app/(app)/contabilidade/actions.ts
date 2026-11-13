"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { accountSchema, closePeriodSchema, journalEntrySchema } from "@/schemas/accounting";
import { uuidSchema } from "@/schemas/common";
import { taxFormSchema } from "@/schemas/taxes";
import type { Json } from "@/types/database";
import type { ActionResult } from "@/types/domain";
import { parentCode } from "@/utils/accounting";
import { dasDueDate, lastDayOf, runTaxCalc, taxPostingLines } from "@/utils/taxes";
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


// ---------------------------------------------------------------------------
// Apuração de tributos (DAS / Lucro Presumido)
// ---------------------------------------------------------------------------
const COMPETENCE_LABEL = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;

/**
 * Recalcula no servidor (o resultado enviado pelo navegador é ignorado), grava a
 * apuração e, se pedido — ou se ela já estava contabilizada —, gera/atualiza o
 * lançamento contábil no último dia da competência.
 */
export async function saveTaxAssessment(companyId: string, input: unknown, post: boolean): Promise<ActionResult<{ id: string }>> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  const parsed = taxFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const calc = runTaxCalc(v as Parameters<typeof runTaxCalc>[0]);
  if (!calc.ok) return { ok: false, error: calc.error };

  const { data: existing } = await w.supabase
    .from("tax_assessments")
    .select("id, entry_id")
    .eq("company_id", companyId)
    .eq("competence", v.competence)
    .eq("regime", v.regime)
    .maybeSingle();

  let entryId = existing?.entry_id ?? null;
  if (post || entryId) {
    const postings = taxPostingLines(calc);
    if (!postings.length) return { ok: false, error: "Não há valor a contabilizar." };
    const codes = [...new Set(postings.flatMap((p) => [p.debit, p.credit]))];
    const { data: accs } = await w.supabase.from("accounts").select("id, code, is_analytic, active").eq("company_id", companyId).in("code", codes);
    const byCode = new Map((accs ?? []).map((a) => [a.code, a]));
    const missing = codes.filter((c) => !byCode.get(c)?.is_analytic || !byCode.get(c)?.active);
    if (missing.length) return { ok: false, error: `Para contabilizar, o plano de contas precisa das contas analíticas ativas: ${missing.join(", ")}.` };
    // agrega por conta e lado
    const agg = new Map<string, { account_id: string; debit: number; credit: number; memo: string }>();
    for (const p of postings) {
      for (const [code, side] of [[p.debit, "debit"], [p.credit, "credit"]] as const) {
        const key = `${code}:${side}`;
        const cur = agg.get(key) ?? { account_id: byCode.get(code)!.id, debit: 0, credit: 0, memo: "" };
        cur[side] += p.amount;
        cur.memo = cur.memo ? `${cur.memo}, ${p.memo}` : p.memo;
        agg.set(key, cur);
      }
    }
    const label = v.regime === "simples_nacional" ? "DAS — Simples Nacional" : "Tributos — Lucro Presumido";
    const { data: eid, error } = await w.supabase.rpc("save_journal_entry", {
      p_company_id: companyId,
      p_entry_id: entryId,
      p_entry: { entry_date: lastDayOf(v.competence), description: `Apuração ${label} ${COMPETENCE_LABEL(v.competence)}` },
      p_lines: [...agg.values()].map((l) => ({ account_id: l.account_id, debit: l.debit / 100, credit: l.credit / 100, memo: l.memo.slice(0, 200) })),
    });
    if (error || !eid) return { ok: false, error: friendlyDbError(error) };
    entryId = eid;
  }

  const row = {
    inputs: v as unknown as Json,
    result: calc as unknown as Json,
    total: calc.total / 100,
    due_date: v.regime === "simples_nacional" ? dasDueDate(v.competence) : null,
    entry_id: entryId,
  };
  const res = existing
    ? await w.supabase.from("tax_assessments").update(row).eq("id", existing.id).select("id").single()
    : await w.supabase
        .from("tax_assessments")
        .insert({ ...row, organization_id: w.ctx.organization.id, company_id: companyId, competence: v.competence, regime: v.regime })
        .select("id")
        .single();
  if (res.error || !res.data) return { ok: false, error: friendlyDbError(res.error) };
  refresh(companyId);
  return {
    ok: true,
    data: { id: res.data.id },
    message: entryId ? "Apuração salva e contabilizada." : "Apuração salva.",
  };
}

export async function deleteTaxAssessment(companyId: string, assessmentId: string): Promise<ActionResult> {
  const w = await writeContext(companyId);
  if ("error" in w) return { ok: false, error: w.error! };
  if (!uuidSchema.safeParse(assessmentId).success) return { ok: false, error: "Apuração inválida." };
  const { data: a } = await w.supabase.from("tax_assessments").select("id, entry_id").eq("id", assessmentId).eq("company_id", companyId).maybeSingle();
  if (!a) return { ok: false, error: DENIED };
  if (a.entry_id) {
    // O lançamento sai junto; o banco recusa se o período estiver fechado.
    const { error } = await w.supabase.from("journal_entries").delete().eq("id", a.entry_id).eq("company_id", companyId);
    if (error) return { ok: false, error: friendlyDbError(error) };
  }
  const { error, count } = await w.supabase.from("tax_assessments").delete({ count: "exact" }).eq("id", a.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: DENIED };
  refresh(companyId);
  return { ok: true, data: undefined, message: a.entry_id ? "Apuração e lançamento excluídos." : "Apuração excluída." };
}
