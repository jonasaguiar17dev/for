import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AccountRow, CompanyRow, JournalEntryRow, JournalLineRow, TrialBalanceRow } from "@/types/database";
import { compareCodes } from "@/utils/accounting";

/** Divide listas grandes de ids para manter a URL do PostgREST curta. */
async function inChunks<T>(ids: string[], fetch: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const { data, error } = await fetch(ids.slice(i, i + 80));
    if (error) throw new Error("Não foi possível carregar os dados contábeis.");
    out.push(...(data ?? []));
  }
  return out;
}

export type AccountingCompany = Pick<CompanyRow, "id" | "corporate_name" | "trade_name" | "cnpj" | "is_internal" | "status"> & {
  has_chart: boolean;
  closed_until: string | null;
};

/** Empresas visíveis ao usuário (RLS) com a situação da escrituração. */
export async function listAccountingCompanies(organizationId: string): Promise<AccountingCompany[]> {
  const supabase = await createClient();
  const [{ data: companies, error }, { data: roots }, { data: settings }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, corporate_name, trade_name, cnpj, is_internal, status")
      .eq("organization_id", organizationId)
      .order("corporate_name"),
    supabase.from("accounts").select("company_id").eq("organization_id", organizationId).eq("code", "1"),
    supabase.from("accounting_settings").select("company_id, closed_until").eq("organization_id", organizationId),
  ]);
  if (error) throw new Error("Não foi possível carregar as empresas.");
  const withChart = new Set((roots ?? []).map((r) => r.company_id));
  const closed = new Map((settings ?? []).map((s) => [s.company_id, s.closed_until]));
  return (companies ?? [])
    .map((c) => ({ ...c, has_chart: withChart.has(c.id), closed_until: closed.get(c.id) ?? null }))
    .sort((a, b) => Number(b.is_internal) - Number(a.is_internal));
}

export async function getAccountingCompany(organizationId: string, companyId: string): Promise<AccountingCompany | null> {
  const supabase = await createClient();
  const [{ data: company }, { data: settings }, { count }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, corporate_name, trade_name, cnpj, is_internal, status")
      .eq("organization_id", organizationId)
      .eq("id", companyId)
      .maybeSingle(),
    supabase.from("accounting_settings").select("closed_until").eq("company_id", companyId).maybeSingle(),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  ]);
  if (!company) return null;
  return { ...company, has_chart: Boolean(count), closed_until: settings?.closed_until ?? null };
}

export async function listAccounts(companyId: string): Promise<AccountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").select("*").eq("company_id", companyId);
  if (error) throw new Error("Não foi possível carregar o plano de contas.");
  return (data ?? []).sort((a, b) => compareCodes(a.code, b.code));
}

export type EntryLine = JournalLineRow & { account: Pick<AccountRow, "code" | "name"> | null };
export type EntryWithLines = JournalEntryRow & { lines: EntryLine[]; total: number };

async function attachLines(entries: JournalEntryRow[], companyId: string): Promise<EntryWithLines[]> {
  if (!entries.length) return [];
  const supabase = await createClient();
  const [lines, { data: accounts }] = await Promise.all([
    inChunks(
      entries.map((e) => e.id),
      (chunk) => supabase.from("journal_lines").select("*").in("entry_id", chunk).order("position"),
    ),
    supabase.from("accounts").select("id, code, name").eq("company_id", companyId),
  ]);
  const byAccount = new Map((accounts ?? []).map((a) => [a.id, a]));
  return entries.map((e) => {
    const ls = lines
      .filter((l) => l.entry_id === e.id)
      .map((l) => ({ ...l, debit: Number(l.debit), credit: Number(l.credit), account: byAccount.get(l.account_id) ?? null }));
    return { ...e, lines: ls, total: Math.round(ls.reduce((a, l) => a + l.debit * 100, 0)) / 100 };
  });
}

export const ENTRIES_LIMIT = 300;

/** Lançamentos do período (mais recentes primeiro), com pesquisa no histórico. */
export async function listEntries(
  companyId: string,
  period: { from: string; to: string },
  q?: string,
): Promise<{ entries: EntryWithLines[]; truncated: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("company_id", companyId)
    .gte("entry_date", period.from)
    .lte("entry_date", period.to)
    .order("entry_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(ENTRIES_LIMIT + 1);
  if (error) throw new Error("Não foi possível carregar os lançamentos.");
  let rows = data ?? [];
  const truncated = rows.length > ENTRIES_LIMIT;
  rows = rows.slice(0, ENTRIES_LIMIT);
  const term = q?.trim().toLowerCase();
  if (term) rows = rows.filter((e) => e.description.toLowerCase().includes(term) || String(e.number) === term);
  return { entries: await attachLines(rows, companyId), truncated };
}

export async function getEntry(companyId: string, entryId: string): Promise<EntryWithLines | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("journal_entries").select("*").eq("company_id", companyId).eq("id", entryId).maybeSingle();
  if (!data) return null;
  return (await attachLines([data], companyId))[0];
}

/** Balancete de verificação (saldo anterior, débitos, créditos e saldo final por conta). */
export async function getTrialBalance(companyId: string, period: { from: string; to: string }): Promise<TrialBalanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("trial_balance", { p_company_id: companyId, p_from: period.from, p_to: period.to });
  if (error) throw new Error("Não foi possível calcular o balancete.");
  return (data ?? []).map((r) => ({
    ...r,
    level: Number(r.level),
    opening: Number(r.opening),
    debit: Number(r.debit),
    credit: Number(r.credit),
    closing: Number(r.closing),
  }));
}

export type LedgerLine = { id: string; entry_id: string; number: number; entry_date: string; description: string; memo: string | null; debit: number; credit: number; balance: number };

/** Razão de uma conta analítica no período, com saldo corrente pela natureza da conta. */
export async function getLedger(
  companyId: string,
  account: Pick<AccountRow, "id" | "nature">,
  period: { from: string; to: string },
  opening: number,
): Promise<LedgerLine[]> {
  const supabase = await createClient();
  const { data: lines, error } = await supabase
    .from("journal_lines")
    .select("id, entry_id, debit, credit, memo")
    .eq("company_id", companyId)
    .eq("account_id", account.id);
  if (error) throw new Error("Não foi possível carregar o razão.");
  if (!lines?.length) return [];
  const entries = await inChunks([...new Set(lines.map((l) => l.entry_id))], (chunk) =>
    supabase
      .from("journal_entries")
      .select("id, number, entry_date, description")
      .in("id", chunk)
      .gte("entry_date", period.from)
      .lte("entry_date", period.to),
  );
  const byId = new Map(entries.map((e) => [e.id, e]));
  let balance = opening;
  return lines
    .filter((l) => byId.has(l.entry_id))
    .map((l) => ({ l, e: byId.get(l.entry_id)! }))
    .sort((a, b) => a.e.entry_date.localeCompare(b.e.entry_date) || a.e.number - b.e.number)
    .map(({ l, e }) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      balance = Math.round((balance + (account.nature === "devedora" ? debit - credit : credit - debit)) * 100) / 100;
      return { id: l.id, entry_id: e.id, number: e.number, entry_date: e.entry_date, description: e.description, memo: l.memo, debit, credit, balance };
    });
}
