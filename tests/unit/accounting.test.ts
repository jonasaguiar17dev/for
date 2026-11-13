import { describe, expect, it } from "vitest";

import { journalEntrySchema } from "@/schemas/accounting";
import type { TrialBalanceRow } from "@/types/database";
import { buildBalanceSheet, buildDre, parentCode } from "@/utils/accounting";

const row = (code: string, type: TrialBalanceRow["type"], nature: TrialBalanceRow["nature"], debit: number, credit: number, closing?: number): TrialBalanceRow => ({
  account_id: code, code, name: code, type, nature, is_analytic: true, level: code.split(".").length,
  opening: 0, debit, credit, closing: closing ?? (nature === "devedora" ? debit - credit : credit - debit),
});

const rows = [
  row("1.1.1.02", "ativo", "devedora", 15000, 1500),
  row("1.1.2.01", "ativo", "devedora", 5000, 5000),
  row("1.2.3.04", "ativo", "devedora", 4000, 0),
  row("1.2.3.90", "ativo", "credora", 0, 400),
  row("2.1.3.01", "passivo", "credora", 0, 300),
  row("2.2.1.01", "passivo", "credora", 0, 4000),
  row("2.3.1.01", "patrimonio_liquido", "credora", 0, 10000),
  row("3.1.1.01", "receita", "credora", 0, 5000),
  row("3.2.1.01", "receita", "devedora", 300, 0),
  row("3.3.1.01", "receita", "credora", 0, 0),
  row("5.1.1.03", "despesa", "devedora", 1500, 0),
  row("5.1.1.07", "despesa", "devedora", 400, 0),
];

describe("DRE", () => {
  it("calcula receita líquida, lucro bruto e resultado", () => {
    const d = Object.fromEntries(buildDre(rows).map((l) => [l.key, l.value]));
    expect(d.bruta).toBe(5000);
    expect(d.deducoes).toBe(300);
    expect(d.liquida).toBe(4700);
    expect(d.lucro_bruto).toBe(4700);
    expect(d.operacionais).toBe(1900);
    expect(d.liquido).toBe(2800);
  });
});

describe("Balanço", () => {
  it("fecha ativo com passivo + PL + resultado, considerando conta redutora", () => {
    const b = buildBalanceSheet(rows);
    expect(b.ativoCirculante).toBe(13500);
    expect(b.ativoNaoCirculante).toBe(3600);
    expect(b.passivoCirculante).toBe(300);
    expect(b.passivoNaoCirculante).toBe(4000);
    expect(b.patrimonioLiquido).toBe(10000);
    expect(b.resultadoAcumulado).toBe(2800);
    expect(b.diferenca).toBe(0);
  });
});

describe("lançamento", () => {
  const acc = "00000000-0000-4000-8000-000000000001";
  const acc2 = "00000000-0000-4000-8000-000000000002";
  it("aceita partidas balanceadas e recusa desbalanceadas ou com os dois lados", () => {
    const base = { entry_date: "2027-01-10", description: "Teste" };
    expect(journalEntrySchema.safeParse({ ...base, lines: [{ account_id: acc, debit: "1.000,00", credit: "" }, { account_id: acc2, debit: "", credit: "1000" }] }).success).toBe(true);
    expect(journalEntrySchema.safeParse({ ...base, lines: [{ account_id: acc, debit: "100", credit: "" }, { account_id: acc2, debit: "", credit: "90" }] }).success).toBe(false);
    expect(journalEntrySchema.safeParse({ ...base, lines: [{ account_id: acc, debit: "100", credit: "100" }, { account_id: acc2, debit: "", credit: "" }] }).success).toBe(false);
    expect(journalEntrySchema.safeParse({ ...base, lines: [{ account_id: acc, debit: "100", credit: "" }] }).success).toBe(false);
  });
  it("deriva o código da conta superior", () => {
    expect(parentCode("5.1.1.20")).toBe("5.1.1");
    expect(parentCode("1")).toBeNull();
  });
});
