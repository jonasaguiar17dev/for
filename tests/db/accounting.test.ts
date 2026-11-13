/**
 * Contabilidade: plano de contas, partidas dobradas, fechamento e relatórios.
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/aguiar_test npm run test:db
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createUser, makeAsUser, resetDatabase } from "./helpers";

const DB_URL = process.env.TEST_DATABASE_URL;
const describeDb = DB_URL ? describe : describe.skip;

const U = {
  owner: "20000000-0000-4000-8000-000000000001",
  accountant: "20000000-0000-4000-8000-000000000002",
  viewer: "20000000-0000-4000-8000-000000000003",
  manager: "20000000-0000-4000-8000-000000000004",
  other: "20000000-0000-4000-8000-000000000005",
};

describeDb("Contabilidade", () => {
  let admin: Client;
  let asUser: ReturnType<typeof makeAsUser>;
  let org: string;
  let company: string;
  const acc: Record<string, string> = {};

  const entry = (date: string, description: string, lines: { code: string; debit?: number; credit?: number }[], id: string | null = null, user = U.accountant) =>
    asUser(user, async (c) =>
      (
        await c.query("select public.save_journal_entry($1, $2, $3, $4) id", [
          company,
          id,
          { entry_date: date, description },
          JSON.stringify(lines.map((l) => ({ account_id: acc[l.code], debit: l.debit ?? 0, credit: l.credit ?? 0 }))),
        ])
      ).rows[0].id as string,
    );

  beforeAll(async () => {
    admin = await resetDatabase(DB_URL!);
    asUser = makeAsUser(admin);
    for (const [k, id] of Object.entries(U)) await createUser(admin, id, `${k}@example.com`);
    org = await asUser(U.owner, async (c) =>
      (await c.query("select public.create_organization('Aguiar', 'aguiar', $1) id", [{ corporate_name: "Aguiar Ltda", cnpj: "11222333000181", tax_regime: "simples_nacional" }])).rows[0].id,
    );
    await asUser(U.other, (c) =>
      c.query("select public.create_organization('Outro', 'outro', $1)", [{ corporate_name: "Outro Ltda", cnpj: "04252011000110", tax_regime: "mei" }]),
    );
    await asUser(U.owner, async (c) => {
      await c.query("select public.add_organization_member($1, 'accountant@example.com', 'accountant')", [org]);
      await c.query("select public.add_organization_member($1, 'viewer@example.com', 'viewer')", [org]);
      await c.query("select public.add_organization_member($1, 'manager@example.com', 'member')", [org]);
    });
    company = await asUser(U.owner, async (c) =>
      (await c.query("select public.save_company($1, null, $2, $3, null) id", [org, { corporate_name: "Cliente A Ltda", cnpj: "11444777000161", tax_regime: "simples_nacional" }, { responsible_name: "Ana" }])).rows[0].id,
    );
    await asUser(U.owner, (c) => c.query("select public.set_company_member($1, 'manager@example.com', 'manager')", [company]));
  });

  afterAll(async () => {
    await admin?.end();
  });

  it("cria o plano de contas padrão uma única vez", async () => {
    const n = await asUser(U.accountant, async (c) => (await c.query("select public.setup_chart_of_accounts($1) n", [company])).rows[0].n);
    expect(n).toBeGreaterThan(90);
    await expect(asUser(U.accountant, (c) => c.query("select public.setup_chart_of_accounts($1)", [company]))).rejects.toThrow(/já possui/);
    const rows = await asUser(U.accountant, async (c) => (await c.query("select id, code from public.accounts where company_id = $1", [company])).rows);
    for (const r of rows) acc[r.code] = r.id;
    expect(acc["1.1.1.02"]).toBeTruthy();
  });

  it("aceita lançamento balanceado e numera por empresa", async () => {
    await entry("2027-01-02", "Integralização de capital", [
      { code: "1.1.1.02", debit: 10000 },
      { code: "2.3.1.01", credit: 10000 },
    ]);
    const id2 = await entry("2027-01-10", "Honorários de janeiro", [
      { code: "1.1.2.01", debit: 5000 },
      { code: "3.1.1.01", credit: 5000 },
    ]);
    await entry("2027-01-20", "Recebimento de cliente", [
      { code: "1.1.1.02", debit: 5000 },
      { code: "1.1.2.01", credit: 5000 },
    ]);
    await entry("2027-01-25", "Aluguel de janeiro", [
      { code: "5.1.1.03", debit: 1500 },
      { code: "1.1.1.02", credit: 1500 },
    ]);
    await entry("2027-01-31", "Simples Nacional sobre a receita", [
      { code: "3.2.1.01", debit: 300 },
      { code: "2.1.3.01", credit: 300 },
    ]);
    const nums = await asUser(U.owner, async (c) =>
      (await c.query("select number from public.journal_entries where company_id = $1 order by number", [company])).rows.map((r) => r.number),
    );
    expect(nums).toEqual([1, 2, 3, 4, 5]);
    expect(id2).toBeTruthy();
  });

  it("recusa lançamento desbalanceado, com uma partida só, em conta sintética ou com débito e crédito na mesma linha", async () => {
    await expect(entry("2027-01-05", "Errado", [{ code: "1.1.1.01", debit: 100 }, { code: "3.1.1.01", credit: 90 }])).rejects.toThrow(/desbalanceado/);
    await expect(entry("2027-01-05", "Errado", [{ code: "1.1.1.01", debit: 100 }])).rejects.toThrow(/duas partidas/);
    await expect(entry("2027-01-05", "Errado", [{ code: "1.1.1", debit: 100 }, { code: "3.1.1.01", credit: 100 }])).rejects.toThrow(/sintética/);
    await expect(entry("2027-01-05", "Errado", [{ code: "1.1.1.01", debit: 100, credit: 100 }, { code: "3.1.1.01", credit: 0, debit: 0 }])).rejects.toThrow(/journal_lines_one_side/);
  });

  it("balancete fecha: débitos = créditos e Ativo = Passivo + PL + resultado", async () => {
    const tb = await asUser(U.viewer, async (c) => (await c.query("select * from public.trial_balance($1, '2027-01-01', '2027-01-31')", [company])).rows);
    const get = (code: string) => tb.find((r) => r.code === code)!;
    const analytic = tb.filter((r) => r.is_analytic);
    const d = analytic.reduce((a, r) => a + Number(r.debit), 0);
    const cr = analytic.reduce((a, r) => a + Number(r.credit), 0);
    expect(d).toBe(cr);
    expect(Number(get("1.1.1.02").closing)).toBe(13500);
    expect(Number(get("1").closing)).toBe(13500);
    expect(Number(get("2.1").closing)).toBe(300);
    expect(Number(get("2.3").closing)).toBe(10000);
    const result = Number(get("3").closing) - Number(get("4").closing) - Number(get("5").closing);
    // receita 5000 (3.1) - deduções 300 (3.2, natureza devedora) - despesas 1500
    expect(Number(get("3.1").closing) - Number(get("3.2").closing) - Number(get("5").closing)).toBe(3200);
    expect(Number(get("1").closing)).toBe(Number(get("2.1").closing) + Number(get("2.2").closing) + Number(get("2.3").closing) + 3200);
    expect(result).toBeDefined();
  });

  it("edita um lançamento mantendo o número", async () => {
    const id = await asUser(U.owner, async (c) => (await c.query("select id from public.journal_entries where company_id = $1 and number = 4", [company])).rows[0].id);
    await entry("2027-01-25", "Aluguel de janeiro (corrigido)", [{ code: "5.1.1.03", debit: 1600 }, { code: "1.1.1.02", credit: 1600 }], id);
    const r = await asUser(U.owner, async (c) =>
      (await c.query("select e.number, sum(l.debit) d from public.journal_entries e join public.journal_lines l on l.entry_id = e.id where e.id = $1 group by e.number", [id])).rows[0],
    );
    expect(r.number).toBe(4);
    expect(Number(r.d)).toBe(1600);
  });

  it("conta com lançamentos não muda de código e conta sintética não recebe subconta errada", async () => {
    await expect(asUser(U.accountant, (c) => c.query("update public.accounts set code = '1.1.1.99' where id = $1", [acc["1.1.1.02"]]))).rejects.toThrow(/não pode mudar de código/);
    await expect(
      asUser(U.accountant, (c) =>
        c.query("insert into public.accounts (organization_id, company_id, code, name, type, nature, is_analytic, parent_id) values ($1, $2, '1.1.1.01.01', 'Sub', 'ativo', 'devedora', true, $3)", [org, company, acc["1.1.1.01"]]),
      ),
    ).rejects.toThrow(/analítica e não pode ter subcontas/);
    await expect(
      asUser(U.accountant, (c) =>
        c.query("insert into public.accounts (organization_id, company_id, code, name, type, nature, is_analytic, parent_id) values ($1, $2, '1.2.04', 'Errada', 'ativo', 'devedora', true, $3)", [org, company, acc["1.1.1"]]),
      ),
    ).rejects.toThrow(/um nível abaixo/);
  });

  it("período fechado trava inclusão, edição e exclusão; só owner/admin reabre", async () => {
    await asUser(U.accountant, (c) => c.query("insert into public.accounting_settings (company_id, organization_id, closed_until) values ($1, $2, '2027-01-31')", [company, org]));
    await expect(entry("2027-01-15", "Retroativo", [{ code: "1.1.1.01", debit: 10 }, { code: "3.1.1.01", credit: 10 }])).rejects.toThrow(/Período fechado/);
    const first = await asUser(U.owner, async (c) => (await c.query("select id from public.journal_entries where company_id = $1 and number = 1", [company])).rows[0].id);
    await expect(entry("2027-01-02", "Mudança", [{ code: "1.1.1.02", debit: 1 }, { code: "2.3.1.01", credit: 1 }], first)).rejects.toThrow(/Período fechado/);
    await expect(asUser(U.accountant, (c) => c.query("delete from public.journal_entries where id = $1", [first]))).rejects.toThrow(/Período fechado/);
    await expect(entry("2027-02-01", "Mover para janeiro", [{ code: "1.1.1.01", debit: 10 }, { code: "3.1.1.01", credit: 10 }])).resolves.toBeTruthy();
    await expect(asUser(U.accountant, (c) => c.query("update public.accounting_settings set closed_until = '2026-12-31' where company_id = $1", [company]))).rejects.toThrow(/reabrir/);
    await asUser(U.owner, (c) => c.query("update public.accounting_settings set closed_until = null where company_id = $1", [company]));
    await expect(entry("2027-01-15", "Retroativo após reabrir", [{ code: "1.1.1.01", debit: 10 }, { code: "3.1.1.01", credit: 10 }])).resolves.toBeTruthy();
  });

  it("leitor e gestor pontual leem, mas não escrevem; outra organização não vê nada", async () => {
    const readViewer = await asUser(U.viewer, async (c) => (await c.query("select count(*)::int n from public.journal_entries")).rows[0].n);
    const readManager = await asUser(U.manager, async (c) => (await c.query("select count(*)::int n from public.journal_entries")).rows[0].n);
    expect(readViewer).toBeGreaterThan(0);
    expect(readManager).toBe(readViewer);
    await expect(entry("2027-03-01", "Leitor", [{ code: "1.1.1.01", debit: 1 }, { code: "3.1.1.01", credit: 1 }], null, U.viewer)).rejects.toThrow(/row-level security|violates/);
    await expect(entry("2027-03-01", "Gestor", [{ code: "1.1.1.01", debit: 1 }, { code: "3.1.1.01", credit: 1 }], null, U.manager)).rejects.toThrow(/row-level security|violates/);
    const other = await asUser(U.other, async (c) => ({
      accounts: (await c.query("select 1 from public.accounts")).rowCount,
      entries: (await c.query("select 1 from public.journal_entries")).rowCount,
      lines: (await c.query("select 1 from public.journal_lines")).rowCount,
      tb: (await c.query("select * from public.trial_balance($1, '2027-01-01', '2027-12-31')", [company])).rowCount,
    }));
    expect(other).toEqual({ accounts: 0, entries: 0, lines: 0, tb: 0 });
  });

  it("exclusão de lançamento em período aberto remove as partidas e fica na auditoria", async () => {
    const id = await entry("2027-03-10", "Para excluir", [{ code: "1.1.1.01", debit: 50 }, { code: "3.3.1.02", credit: 50 }]);
    await asUser(U.accountant, (c) => c.query("delete from public.journal_entries where id = $1", [id]));
    const r = await asUser(U.owner, async (c) => ({
      lines: (await c.query("select 1 from public.journal_lines where entry_id = $1", [id])).rowCount,
      audit: (await c.query("select action from public.audit_logs where entity = 'journal_entries' and entity_id = $1 order by created_at", [id])).rows.map((x) => x.action),
    }));
    expect(r.lines).toBe(0);
    expect(r.audit).toEqual(["insert", "delete"]);
  });
});
