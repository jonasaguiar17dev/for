/**
 * Contratos, faturamento e contas a receber — regras de negócio e RLS.
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/aguiar_test npm run test:db
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createUser, makeAsUser, resetDatabase } from "./helpers";

const DB_URL = process.env.TEST_DATABASE_URL;
const describeDb = DB_URL ? describe : describe.skip;

const U = {
  owner: "10000000-0000-4000-8000-000000000001",
  accountant: "10000000-0000-4000-8000-000000000002",
  manager: "10000000-0000-4000-8000-000000000003",
  viewer: "10000000-0000-4000-8000-000000000004",
  other: "10000000-0000-4000-8000-000000000005",
};

const company = (cnpj: string, name: string) => ({ corporate_name: name, cnpj, tax_regime: "simples_nacional" });

describeDb("Contratos e financeiro", () => {
  let admin: Client;
  let asUser: ReturnType<typeof makeAsUser>;
  let org: string;
  let orgB: string;
  let clientA: string;
  let clientB: string;
  let serviceId: string;
  let contractId: string;

  beforeAll(async () => {
    admin = await resetDatabase(DB_URL!);
    asUser = makeAsUser(admin);
    for (const [k, id] of Object.entries(U)) await createUser(admin, id, `${k}@example.com`);

    org = await asUser(U.owner, async (c) =>
      (await c.query("select public.create_organization('Aguiar', 'aguiar', $1) id", [company("11222333000181", "Aguiar Ltda")])).rows[0].id,
    );
    orgB = await asUser(U.other, async (c) =>
      (await c.query("select public.create_organization('Outro', 'outro', $1) id", [company("04252011000110", "Outro Ltda")])).rows[0].id,
    );
    await asUser(U.owner, async (c) => {
      await c.query("select public.add_organization_member($1, 'accountant@example.com', 'accountant')", [org]);
      await c.query("select public.add_organization_member($1, 'manager@example.com', 'member')", [org]);
      await c.query("select public.add_organization_member($1, 'viewer@example.com', 'viewer')", [org]);
    });
    clientA = await asUser(U.owner, async (c) =>
      (await c.query("select public.save_company($1, null, $2, $3, null) id", [org, company("11444777000161", "Cliente A Ltda"), { responsible_name: "Ana" }])).rows[0].id,
    );
    clientB = await asUser(U.other, async (c) =>
      (await c.query("select public.save_company($1, null, $2, $3, null) id", [orgB, company("33000167000101", "Cliente B Ltda"), { responsible_name: "Beto" }])).rows[0].id,
    );
    await asUser(U.owner, (c) => c.query("select public.set_company_member($1, 'manager@example.com', 'manager')", [clientA]));

    serviceId = await asUser(U.owner, async (c) =>
      (await c.query("insert into public.services (organization_id, name, default_amount) values ($1, 'Contabilidade mensal', 850) returning id", [org])).rows[0].id,
    );
  });

  afterAll(async () => {
    await admin?.end();
  });

  const items = () =>
    JSON.stringify([
      { service_id: serviceId, description: "Contabilidade mensal", quantity: 1, unit_amount: 850, billing_frequency: "mensal" },
      { description: "Folha de pagamento", quantity: 3, unit_amount: 45.5, billing_frequency: "mensal" },
      { description: "DEFIS anual", quantity: 1, unit_amount: 300, billing_frequency: "anual" },
      { description: "Abertura de filial", quantity: 1, unit_amount: 1200, billing_frequency: "avulso" },
    ]);

  it("contador cria contrato com numeração sequencial por ano", async () => {
    const r = await asUser(U.accountant, async (c) => {
      const id1 = (await c.query("select public.save_contract($1, null, $2, $3) id", [
        org, { company_id: clientA, start_date: "2027-01-01", billing_day: 10 }, items(),
      ])).rows[0].id;
      const id2 = (await c.query("select public.save_contract($1, null, $2, $3) id", [
        org, { company_id: clientA, start_date: "2027-03-15", billing_day: 5, status: "rascunho" },
        JSON.stringify([{ description: "Consultoria", quantity: 1, unit_amount: 100, billing_frequency: "mensal" }]),
      ])).rows[0].id;
      return (await c.query("select id, number from public.contracts where id = any($1) order by number", [[id1, id2]])).rows;
    });
    expect(r.map((x) => x.number)).toEqual(["CT-2027-0001", "CT-2027-0002"]);
    contractId = r[0].id;
  });

  it("exige ao menos um item", async () => {
    await expect(
      asUser(U.accountant, (c) =>
        c.query("select public.save_contract($1, null, $2, '[]'::jsonb)", [org, { company_id: clientA, start_date: "2027-01-01" }]),
      ),
    ).rejects.toThrow(/ao menos um serviço/);
  });

  it("não permite contrato para empresa de outra organização", async () => {
    await expect(
      asUser(U.accountant, (c) =>
        c.query("select public.save_contract($1, null, $2, $3)", [org, { company_id: clientB, start_date: "2027-01-01" }, items()]),
      ),
    ).rejects.toThrow(/contracts_company_fk|violates foreign key/);
  });

  it("gestor pontual da empresa e leitor não alteram contratos nem geram faturamento", async () => {
    const seenByManager = await asUser(U.manager, async (c) => (await c.query("select 1 from public.contracts")).rowCount);
    expect(seenByManager).toBe(2); // os dois contratos da empresa vinculada
    await expect(
      asUser(U.manager, (c) => c.query("select public.generate_billing($1, '2027-01-01')", [org])),
    ).rejects.toThrow(/Sem permissão/);
    const updated = await asUser(U.viewer, (c) => c.query("update public.contracts set notes = 'x' where id = $1", [contractId]));
    expect(updated.rowCount).toBe(0);
  });

  it("gera faturamento conforme periodicidade e é idempotente", async () => {
    const r = await asUser(U.accountant, async (c) => {
      const jan = (await c.query("select public.generate_billing($1, '2027-01-20') n", [org])).rows[0].n;
      const janAgain = (await c.query("select public.generate_billing($1, '2027-01-01') n", [org])).rows[0].n;
      const feb = (await c.query("select public.generate_billing($1, '2027-02-01') n", [org])).rows[0].n;
      const rows = (await c.query("select competence::text, due_date::text, amount::text from public.receivables where contract_id = $1 order by competence", [contractId])).rows;
      return { jan, janAgain, feb, rows };
    });
    expect(r.jan).toBe(1); // o contrato em rascunho não fatura
    expect(r.janAgain).toBe(0);
    expect(r.feb).toBe(1);
    // Jan: 850 + 3×45,50 + 300 (anual) + 1200 (avulso) = 2486,50 ; Fev: 850 + 136,50 = 986,50
    expect(r.rows).toEqual([
      { competence: "2027-01-01", due_date: "2027-01-10", amount: "2486.50" },
      { competence: "2027-02-01", due_date: "2027-02-10", amount: "986.50" },
    ]);
  });

  it("registra pagamento com consistência e calcula indicadores", async () => {
    await asUser(U.accountant, (c) =>
      c.query("update public.receivables set status = 'pago', paid_at = '2027-01-12', paid_amount = amount, payment_method = 'pix' where contract_id = $1 and competence = '2027-01-01'", [contractId]),
    );
    await expect(
      asUser(U.accountant, (c) => c.query("update public.receivables set status = 'pago' where contract_id = $1 and competence = '2027-02-01'", [contractId])),
    ).rejects.toThrow(/receivables_paid_check/);

    const s = await asUser(U.owner, async (c) => (await c.query("select public.finance_summary($1, '2027-02-20') s", [org])).rows[0].s);
    expect(Number(s.open_total)).toBe(986.5);
    expect(Number(s.overdue_total)).toBe(986.5); // venceu em 10/02
    expect(Number(s.month_billed)).toBe(986.5);
    expect(s.active_contracts).toBe(1);
    expect(Number(s.mrr)).toBe(986.5);
    const jan = s.received_by_month.find((m: { month: string }) => m.month === "2027-01");
    expect(Number(jan.received)).toBe(2486.5);
  });

  it("indica cobranças que vencem nos próximos 7 dias", async () => {
    const r = await asUser(U.owner, async (c) => ({
      s: (await c.query("select public.finance_summary($1, '2027-02-05') s", [org])).rows[0].s,
      soon: (await c.query("select id from public.search_receivables($1, null, 'vence_em_breve', null, null, '2027-02-05')", [org])).rowCount,
    }));
    expect(r.s.due_soon_count).toBe(1); // fevereiro vence em 10/02
    expect(Number(r.s.due_soon_total)).toBe(986.5);
    expect(r.soon).toBe(1);
  });

  it("devolve séries mensais para o dashboard", async () => {
    const s = await asUser(U.owner, async (c) => (await c.query("select public.finance_summary($1, '2027-02-20', 3) s", [org])).rows[0].s);
    expect(s.received_by_month.map((m: { month: string }) => m.month)).toEqual(["2026-12", "2027-01", "2027-02"]);
    const jan = s.received_by_month[1];
    expect(Number(jan.billed)).toBe(2486.5);
    expect(Number(jan.comp_paid)).toBe(2486.5);
    expect(Number(jan.open_end)).toBe(0); // pago em 12/01
    const feb = s.received_by_month[2];
    expect(Number(feb.overdue_end)).toBe(986.5); // venceu em 10/02 e segue aberto em 20/02
    expect(Number(feb.due_total)).toBe(986.5);
    expect(Number(feb.due_open)).toBe(986.5);
    expect(Number(feb.mrr)).toBe(986.5);
    expect(s.contracts_total).toBe(1); // o rascunho não conta
    expect(s.upcoming).toEqual([]);
  });

  it("pesquisa cobranças por situação derivada (vencido / a vencer)", async () => {
    const r = await asUser(U.owner, async (c) => ({
      overdue: (await c.query("select id from public.search_receivables($1, null, 'vencido', null, null, '2027-02-20')", [org])).rowCount,
      upcoming: (await c.query("select id from public.search_receivables($1, null, 'a_vencer', null, null, '2027-02-01')", [org])).rowCount,
      paid: (await c.query("select id from public.search_receivables($1, 'cliente a', 'pago')", [org])).rowCount,
    }));
    expect(r).toEqual({ overdue: 1, upcoming: 1, paid: 1 });
  });

  it("outra organização não vê contratos nem cobranças", async () => {
    const r = await asUser(U.other, async (c) => ({
      contracts: (await c.query("select 1 from public.contracts")).rowCount,
      items: (await c.query("select 1 from public.contract_items")).rowCount,
      receivables: (await c.query("select 1 from public.receivables")).rowCount,
      services: (await c.query("select 1 from public.services")).rowCount,
      summary: (await c.query("select public.finance_summary($1) s", [org])).rows[0].s,
    }));
    expect(r.contracts).toBe(0);
    expect(r.items).toBe(0);
    expect(r.receivables).toBe(0);
    expect(r.services).toBe(0);
    expect(Number(r.summary.open_total)).toBe(0);
    await expect(
      asUser(U.other, (c) => c.query("select public.generate_billing($1, '2027-03-01')", [org])),
    ).rejects.toThrow(/Sem permissão/);
  });

  it("cancelar uma cobrança permite gerar de novo a competência", async () => {
    const n = await asUser(U.accountant, async (c) => {
      await c.query("update public.receivables set status = 'cancelado' where contract_id = $1 and competence = '2027-02-01'", [contractId]);
      return (await c.query("select public.generate_billing($1, '2027-02-01') n", [org])).rows[0].n;
    });
    expect(n).toBe(1);
  });

  it("alterações financeiras ficam na auditoria da empresa", async () => {
    const entities = await asUser(U.owner, async (c) =>
      (await c.query("select distinct entity from public.audit_logs where company_id = $1", [clientA])).rows.map((x) => x.entity).sort(),
    );
    expect(entities).toEqual(expect.arrayContaining(["contract_items", "contracts", "receivables"]));
  });

  it("somente proprietário/administrador edita o catálogo de serviços", async () => {
    const r = await asUser(U.accountant, (c) => c.query("update public.services set default_amount = 1 where id = $1", [serviceId]));
    expect(r.rowCount).toBe(0);
  });
});
