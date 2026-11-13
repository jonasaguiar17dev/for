/**
 * Testes de integração do banco: migrations + Row Level Security.
 *
 * Executam contra um PostgreSQL local (não contra o Supabase Cloud). O banco
 * indicado em TEST_DATABASE_URL é recriado a cada execução, recebe um stub
 * mínimo do Supabase (supabase/tests/supabase_stub.sql) e todas as migrations.
 *
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/aguiar_test npm run test:db
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_URL = process.env.TEST_DATABASE_URL;
const root = path.resolve(__dirname, "../..");

const ids = {
  ownerA: "00000000-0000-4000-8000-00000000000a",
  accountantA: "00000000-0000-4000-8000-00000000000b",
  memberA: "00000000-0000-4000-8000-00000000000c",
  viewerA: "00000000-0000-4000-8000-00000000000d",
  ownerB: "00000000-0000-4000-8000-00000000000e",
  outsider: "00000000-0000-4000-8000-00000000000f",
};

// CNPJs válidos (numéricos e alfanumérico).
const CNPJ = {
  aguiar: "11222333000181",
  clientA1: "11444777000161",
  clientA2: "12ABC34501DE35",
  aguiarB: "04252011000110",
  clientB1: "33000167000101",
};

const describeDb = DB_URL ? describe : describe.skip;

describeDb("RLS e isolamento multiempresa", () => {
  let admin: Client;
  let orgA: string;
  let orgB: string;
  let companyA1: string;
  let companyA2: string;
  let companyB1: string;

  async function asUser<T>(userId: string, fn: (c: Client) => Promise<T>): Promise<T> {
    await admin.query("begin");
    try {
      await admin.query("set local role authenticated");
      await admin.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
      const result = await fn(admin);
      await admin.query("commit");
      return result;
    } catch (error) {
      await admin.query("rollback");
      throw error;
    }
  }

  const companyPayload = (cnpj: string, name: string) => ({
    corporate_name: name,
    trade_name: name.split(" ")[0],
    cnpj,
    tax_regime: "simples_nacional",
    cnae: "6920601",
    address: { city: "São Paulo", state: "SP" },
  });

  beforeAll(async () => {
    const url = new URL(DB_URL!);
    const dbName = url.pathname.slice(1);
    const maintenance = new Client({ connectionString: DB_URL!.replace(/\/[^/]+$/, "/postgres") });
    await maintenance.connect();
    await maintenance.query(`drop database if exists "${dbName}" with (force)`);
    await maintenance.query(`create database "${dbName}"`);
    await maintenance.end();

    admin = new Client({ connectionString: DB_URL });
    await admin.connect();
    await admin.query(readFileSync(path.join(root, "supabase/tests/supabase_stub.sql"), "utf8"));
    const dir = path.join(root, "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await admin.query(readFileSync(path.join(dir, file), "utf8"));
    }

    for (const [name, id] of Object.entries(ids)) {
      await admin.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
        id,
        `${name.toLowerCase()}@example.com`,
        JSON.stringify({ full_name: name }),
      ]);
    }

    orgA = await asUser(ids.ownerA, async (c) => {
      const r = await c.query("select public.create_organization($1, $2, $3) as id", [
        "Aguiar Contabilidade & Gestão",
        "aguiar",
        companyPayload(CNPJ.aguiar, "Aguiar Contabilidade e Gestão Ltda"),
      ]);
      return r.rows[0].id as string;
    });
    orgB = await asUser(ids.ownerB, async (c) => {
      const r = await c.query("select public.create_organization($1, $2, $3) as id", [
        "Outro Escritório",
        "outro",
        companyPayload(CNPJ.aguiarB, "Outro Escritório Contábil Ltda"),
      ]);
      return r.rows[0].id as string;
    });

    await asUser(ids.ownerA, async (c) => {
      await c.query("select public.add_organization_member($1, $2, 'accountant')", [orgA, "accountanta@example.com"]);
      await c.query("select public.add_organization_member($1, $2, 'member')", [orgA, "membera@example.com"]);
      await c.query("select public.add_organization_member($1, $2, 'viewer')", [orgA, "viewera@example.com"]);
    });

    companyA1 = await asUser(ids.accountantA, async (c) => {
      const r = await c.query("select public.save_company($1, null, $2, $3, $4) as id", [
        orgA,
        companyPayload(CNPJ.clientA1, "Padaria Pão Quente Ltda"),
        { responsible_name: "Maria Souza", email: "maria@padaria.com.br", contract_status: "ativo" },
        JSON.stringify([{ name: "João", email: "joao@padaria.com.br", position: "Financeiro" }]),
      ]);
      return r.rows[0].id as string;
    });
    companyA2 = await asUser(ids.ownerA, async (c) => {
      const r = await c.query("select public.save_company($1, null, $2, $3, '[]'::jsonb) as id", [
        orgA,
        companyPayload(CNPJ.clientA2, "Tech Alfa Numérica S.A."),
        { responsible_name: "Carlos Lima" },
      ]);
      return r.rows[0].id as string;
    });
    companyB1 = await asUser(ids.ownerB, async (c) => {
      const r = await c.query("select public.save_company($1, null, $2, $3, null) as id", [
        orgB,
        companyPayload(CNPJ.clientB1, "Cliente do Escritório B Ltda"),
        { responsible_name: "Ana B", contract_status: "suspenso" },
      ]);
      return r.rows[0].id as string;
    });

    await asUser(ids.ownerA, (c) =>
      c.query("select public.set_company_member($1, $2, 'viewer')", [companyA1, "membera@example.com"]),
    );
  });

  afterAll(async () => {
    await admin?.end();
  });

  it("valida CNPJ numérico e alfanumérico no banco", async () => {
    const r = await admin.query(
      "select public.is_valid_cnpj($1) a, public.is_valid_cnpj($2) b, public.is_valid_cnpj($3) c, public.is_valid_cnpj($4) d",
      [CNPJ.clientA1, CNPJ.clientA2, "11444777000162", "11111111111111"],
    );
    expect(r.rows[0]).toEqual({ a: true, b: true, c: false, d: false });
  });

  it("rejeita empresa com CNPJ inválido", async () => {
    await expect(
      asUser(ids.ownerA, (c) =>
        c.query("select public.save_company($1, null, $2, null, null)", [
          orgA,
          companyPayload("11444777000162", "Inválida Ltda"),
        ]),
      ),
    ).rejects.toThrow(/check constraint|is_valid_cnpj|violates/);
  });

  it("rejeita CNPJ duplicado na mesma organização", async () => {
    await expect(
      asUser(ids.ownerA, (c) =>
        c.query("select public.save_company($1, null, $2, null, null)", [
          orgA,
          companyPayload(CNPJ.clientA1, "Duplicada Ltda"),
        ]),
      ),
    ).rejects.toThrow(/companies_org_cnpj_key/);
  });

  it("usuário da organização B não enxerga dados da organização A", async () => {
    const result = await asUser(ids.ownerB, async (c) => ({
      orgs: (await c.query("select id from public.organizations")).rows.map((r) => r.id),
      companies: (await c.query("select id from public.companies")).rows.map((r) => r.id),
      clients: (await c.query("select company_id from public.clients")).rows.map((r) => r.company_id),
      contacts: (await c.query("select id from public.client_contacts")).rowCount,
      logs: (await c.query("select count(*)::int n from public.audit_logs where organization_id = $1", [orgA])).rows[0].n,
      search: (await c.query("select * from public.search_companies($1)", [orgA])).rowCount,
    }));
    expect(result.orgs).toEqual([orgB]);
    expect(result.companies).not.toContain(companyA1);
    expect(result.companies).toContain(companyB1);
    expect(result.clients).toEqual([companyB1]);
    expect(result.contacts).toBe(0);
    expect(result.logs).toBe(0);
    expect(result.search).toBe(0);
  });

  it("dashboard retorna zero para organização sem acesso e dados reais para a própria", async () => {
    const [foreign, own] = await asUser(ids.ownerB, async (c) => [
      (await c.query("select public.dashboard_summary($1) s", [orgA])).rows[0].s,
      (await c.query("select public.dashboard_summary($1) s", [orgB])).rows[0].s,
    ]);
    expect(foreign.total_companies).toBe(0);
    expect(foreign.clients_by_status).toEqual({});
    expect(own.total_companies).toBe(1);
    expect(own.clients_by_status).toEqual({ suspenso: 1 });
  });

  it("usuário da organização B não consegue alterar empresa da organização A", async () => {
    await expect(
      asUser(ids.ownerB, (c) =>
        c.query("select public.save_company($1, $2, $3, null, null)", [
          orgA,
          companyA1,
          companyPayload(CNPJ.clientA1, "Invadida Ltda"),
        ]),
      ),
    ).rejects.toThrow(/sem permissão/);

    const updated = await asUser(ids.ownerB, (c) =>
      c.query("update public.companies set corporate_name = 'X' where id = $1", [companyA1]),
    );
    expect(updated.rowCount).toBe(0);
  });

  it("não permite inserir empresa em organização alheia", async () => {
    await expect(
      asUser(ids.ownerB, (c) =>
        c.query("select public.save_company($1, null, $2, null, null)", [
          orgA,
          companyPayload("11222333000262", "Intrusa Ltda"),
        ]),
      ),
    ).rejects.toThrow(/row-level security|violates/);
  });

  it("colaborador ('member') só vê empresas vinculadas e não edita como 'viewer'", async () => {
    const visible = await asUser(ids.memberA, async (c) =>
      (await c.query("select id from public.companies order by corporate_name")).rows.map((r) => r.id),
    );
    expect(visible).toEqual([companyA1]);

    const updated = await asUser(ids.memberA, (c) =>
      c.query("update public.companies set trade_name = 'Hack' where id = $1", [companyA1]),
    );
    expect(updated.rowCount).toBe(0);
  });

  it("leitor da organização vê todas as empresas mas não edita", async () => {
    const visible = await asUser(ids.viewerA, async (c) => (await c.query("select id from public.companies")).rowCount);
    expect(visible).toBe(3); // interna + 2 clientes
    await expect(
      asUser(ids.viewerA, (c) =>
        c.query("select public.save_company($1, $2, $3, null, null)", [
          orgA,
          companyA2,
          companyPayload(CNPJ.clientA2, "Tech Alfa Numérica S.A."),
        ]),
      ),
    ).rejects.toThrow(/sem permissão/);
  });

  it("contador edita, mas não exclui empresas", async () => {
    await asUser(ids.accountantA, (c) =>
      c.query("select public.save_company($1, $2, $3, $4, null)", [
        orgA,
        companyA1,
        { ...companyPayload(CNPJ.clientA1, "Padaria Pão Quente Ltda"), tax_regime: "lucro_presumido" },
        { responsible_name: "Maria Souza", contract_status: "ativo" },
      ]),
    );
    const deleted = await asUser(ids.accountantA, (c) => c.query("delete from public.companies where id = $1", [companyA1]));
    expect(deleted.rowCount).toBe(0);
  });

  it("registra auditoria com autor e campos alterados", async () => {
    const logs = await asUser(ids.ownerA, async (c) =>
      (
        await c.query(
          "select action, entity, user_id, changes from public.audit_logs where company_id = $1 and entity = 'companies' order by created_at",
          [companyA1],
        )
      ).rows,
    );
    const update = logs.find((l) => l.action === "update");
    expect(logs[0].action).toBe("insert");
    expect(update?.user_id).toBe(ids.accountantA);
    expect(update?.changes.tax_regime).toEqual({ old: "simples_nacional", new: "lucro_presumido" });
  });

  it("audit_logs é imutável para usuários", async () => {
    await expect(
      asUser(ids.ownerA, (c) => c.query("delete from public.audit_logs")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(ids.ownerA, (c) =>
        c.query("insert into public.audit_logs (action, entity) values ('insert', 'fake')"),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("sincroniza contatos (atualiza, cria e remove ausentes)", async () => {
    const contacts = await asUser(ids.ownerA, async (c) => {
      const existing = (await c.query("select id from public.client_contacts where company_id = $1", [companyA1])).rows;
      await c.query("select public.save_company($1, $2, $3, null, $4)", [
        orgA,
        companyA1,
        { ...companyPayload(CNPJ.clientA1, "Padaria Pão Quente Ltda"), tax_regime: "lucro_presumido" },
        JSON.stringify([{ name: "Novo Contato", phone: "11999998888" }]),
      ]);
      const afterReplace = (await c.query("select id, name from public.client_contacts where company_id = $1", [companyA1])).rows;
      return { existing, afterReplace };
    });
    expect(contacts.existing).toHaveLength(1);
    expect(contacts.afterReplace).toHaveLength(1);
    expect(contacts.afterReplace[0].name).toBe("Novo Contato");
  });

  it("não permite mover contato de outra empresa pelo save_company", async () => {
    const foreignContact = await asUser(ids.ownerB, async (c) => {
      const r = await c.query(
        "insert into public.client_contacts (company_id, name) values ($1, 'Contato B') returning id",
        [companyB1],
      );
      return r.rows[0].id as string;
    });
    await expect(
      asUser(ids.ownerA, (c) =>
        c.query("select public.save_company($1, $2, $3, null, $4)", [
          orgA,
          companyA2,
          companyPayload(CNPJ.clientA2, "Tech Alfa Numérica S.A."),
          JSON.stringify([{ id: foreignContact, name: "Roubado" }]),
        ]),
      ),
    ).rejects.toThrow(/não pertence/);
  });

  it("pesquisa por nome e por CNPJ (com máscara) e filtra por regime e situação", async () => {
    const r = await asUser(ids.ownerA, async (c) => ({
      byName: (await c.query("select company_id from public.search_companies($1, 'padaria')", [orgA])).rows,
      byCnpj: (await c.query("select company_id from public.search_companies($1, '12.ABC.345')", [orgA])).rows,
      byRegime: (await c.query("select company_id from public.search_companies($1, null, 'lucro_presumido')", [orgA])).rows,
      byStatus: (await c.query("select company_id from public.search_companies($1, null, null, 'em_implantacao')", [orgA])).rows,
      wildcard: (await c.query("select company_id from public.search_companies($1, '%')", [orgA])).rowCount,
      paged: (await c.query("select company_id, total_count from public.search_companies($1, null, null, null, null, true, 1, 1)", [orgA])).rows,
    }));
    expect(r.byName.map((x) => x.company_id)).toEqual([companyA1]);
    expect(r.byCnpj.map((x) => x.company_id)).toEqual([companyA2]);
    expect(r.byRegime.map((x) => x.company_id)).toEqual([companyA1]);
    expect(r.byStatus.map((x) => x.company_id)).toEqual([companyA2]);
    expect(r.wildcard).toBe(0);
    expect(r.paged).toHaveLength(1);
    expect(Number(r.paged[0].total_count)).toBe(2);
  });

  it("admin não pode se promover a proprietário e a organização mantém um proprietário", async () => {
    await asUser(ids.ownerA, (c) =>
      c.query("update public.organization_members set role = 'admin' where user_id = $1 and organization_id = $2", [
        ids.accountantA,
        orgA,
      ]),
    );
    await expect(
      asUser(ids.accountantA, (c) =>
        c.query("update public.organization_members set role = 'owner' where user_id = $1", [ids.accountantA]),
      ),
    ).rejects.toThrow(/proprietário/);
    await expect(
      asUser(ids.ownerA, (c) =>
        c.query("update public.organization_members set status = 'suspended' where user_id = $1", [ids.ownerA]),
      ),
    ).rejects.toThrow(/ao menos um proprietário/);
  });

  it("membro suspenso perde todo o acesso", async () => {
    await asUser(ids.ownerA, (c) =>
      c.query("update public.organization_members set status = 'suspended' where user_id = $1 and organization_id = $2", [
        ids.memberA,
        orgA,
      ]),
    );
    const visible = await asUser(ids.memberA, async (c) => (await c.query("select id from public.companies")).rowCount);
    expect(visible).toBe(0);
  });

  it("usuário sem vínculo não vê nada e não acessa perfis alheios", async () => {
    const r = await asUser(ids.outsider, async (c) => ({
      companies: (await c.query("select 1 from public.companies")).rowCount,
      profiles: (await c.query("select id from public.profiles")).rows.map((x) => x.id),
    }));
    expect(r.companies).toBe(0);
    expect(r.profiles).toEqual([ids.outsider]);
  });

  it("não permite mover empresa para outra organização", async () => {
    await expect(
      asUser(ids.ownerA, (c) => c.query("update public.companies set organization_id = $1 where id = $2", [orgB, companyA1])),
    ).rejects.toThrow(/organization_id não pode ser alterado|row-level security/);
  });

  it("Storage: só aceita caminhos da própria empresa/organização", async () => {
    const okPath = `${orgA}/${companyA1}/doc.pdf`;
    await asUser(ids.ownerA, (c) =>
      c.query("insert into storage.objects (bucket_id, name) values ('client-documents', $1)", [okPath]),
    );
    // Organização no caminho não corresponde à empresa.
    await expect(
      asUser(ids.ownerA, (c) =>
        c.query("insert into storage.objects (bucket_id, name) values ('client-documents', $1)", [
          `${orgB}/${companyA1}/x.pdf`,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    // Empresa de outra organização.
    await expect(
      asUser(ids.ownerA, (c) =>
        c.query("insert into storage.objects (bucket_id, name) values ('client-documents', $1)", [
          `${orgB}/${companyB1}/x.pdf`,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    const seenByB = await asUser(ids.ownerB, async (c) =>
      (await c.query("select 1 from storage.objects where name = $1", [okPath])).rowCount,
    );
    expect(seenByB).toBe(0);
  });

  it("anon não tem acesso às tabelas", async () => {
    await admin.query("begin");
    try {
      await admin.query("set local role anon");
      await expect(admin.query("select * from public.companies")).rejects.toThrow(/permission denied/);
    } finally {
      await admin.query("rollback");
    }
  });
});
