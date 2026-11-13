import { describe, expect, it } from "vitest";

import { calcPresumido, calcSimples, SIMPLES_TABLES, simplesShares } from "@/utils/taxes";

const R = (reais: number) => Math.round(reais * 100);

describe("Simples Nacional — tabelas", () => {
  it("a repartição de cada faixa soma 100%", () => {
    for (const [annex, faixas] of Object.entries(SIMPLES_TABLES))
      faixas.forEach((f, i) => expect(Object.values(f.reparticao).reduce((a, b) => a + b, 0), `${annex} faixa ${i + 1}`).toBeCloseTo(100, 6));
  });
});

describe("Simples Nacional — DAS", () => {
  it("Anexo III, 4ª faixa: alíquota efetiva e valor", () => {
    const r = calcSimples({ rbt12: R(1_000_000), payroll12: 0, activities: [{ annex: "III", revenue: R(100_000) }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.activities[0].faixa).toBe(4);
    expect(r.activities[0].effectiveRate).toBeCloseTo(12.436, 4); // (1.000.000 × 16% − 35.640) ÷ 1.000.000
    expect(r.total).toBe(R(12_436));
    expect(r.taxes.reduce((a, t) => a + t.amount, 0)).toBe(r.total);
  });

  it("arredonda meio centavo para cima sem erro de ponto flutuante", () => {
    // 27.400 × (211.200 × 7,3% − 5.940) ÷ 211.200 = 1.229,575
    const r = calcSimples({ rbt12: R(211_200), payroll12: 0, activities: [{ annex: "I", revenue: R(27_400) }] });
    expect(r.ok && r.total).toBe(122958);
  });

  it("1ª faixa usa a alíquota nominal (Anexo I, 4%)", () => {
    const r = calcSimples({ rbt12: R(150_000), payroll12: 0, activities: [{ annex: "I", revenue: R(12_500) }] });
    expect(r.ok && r.total).toBe(R(500));
  });

  it("ISS limitado a 5% com redistribuição aos federais (Anexo III, 5ª faixa)", () => {
    const eff = (3_000_000 * 0.21 - 125_640) / 3_000_000; // 16,812%
    const s = simplesShares(SIMPLES_TABLES.III[4].reparticao, eff * 100);
    expect((eff * 100 * s.ISS) / 100).toBeCloseTo(5, 8);
    // fórmula da LC 123: IRPJ = (alíquota efetiva − 5%) × 6,02%
    expect((eff * 100 * s.IRPJ) / 100).toBeCloseTo((eff * 100 - 5) * 0.0602, 2);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 8);
  });

  it("Fator R decide entre Anexo III e V", () => {
    const base = { rbt12: R(600_000), activities: [{ annex: "FATOR_R" as const, revenue: R(50_000) }] };
    const iii = calcSimples({ ...base, payroll12: R(180_000) }); // 30%
    const v = calcSimples({ ...base, payroll12: R(120_000) }); // 20%
    expect(iii.ok && iii.activities[0].appliedAnnex).toBe("III");
    expect(v.ok && v.activities[0].appliedAnnex).toBe("V");
    expect(iii.ok && iii.fatorR).toBeCloseTo(0.3, 6);
  });

  it("início de atividade projeta o RBT12 e acima de 4,8 mi recusa", () => {
    const r = calcSimples({ rbt12: 0, payroll12: 0, activities: [{ annex: "I", revenue: R(10_000) }] });
    expect(r.ok && r.rbt12Used).toBe(R(120_000));
    expect(r.ok && r.rbt12Projected).toBe(true);
    expect(calcSimples({ rbt12: R(5_000_000), payroll12: 0, activities: [{ annex: "I", revenue: R(1) }] }).ok).toBe(false);
  });

  it("várias atividades somam no mesmo DAS", () => {
    const r = calcSimples({ rbt12: R(400_000), payroll12: 0, activities: [{ annex: "I", revenue: R(20_000) }, { annex: "III", revenue: R(10_000) }] });
    expect(r.ok && r.activities.length).toBe(2);
    if (r.ok) expect(r.total).toBe(r.activities[0].amount + r.activities[1].amount);
  });
});

describe("Lucro Presumido", () => {
  it("mês comum: PIS, COFINS e ISS", () => {
    const r = calcPresumido({ competence: "2026-05-01", issRate: 5, activities: [{ activity: "servicos", revenue: R(100_000), quarterRevenue: 0 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = Object.fromEntries(r.taxes.map((x) => [x.tax, x.amount]));
    expect(t).toEqual({ PIS: R(650), COFINS: R(3_000), ISS: R(5_000) });
  });

  it("fim do trimestre: IRPJ com adicional e CSLL", () => {
    const r = calcPresumido({ competence: "2026-06-01", issRate: 0, activities: [{ activity: "servicos", revenue: R(100_000), quarterRevenue: R(300_000) }] });
    if (!r.ok) throw new Error(r.error);
    const t = Object.fromEntries(r.taxes.map((x) => [x.tax, x.amount]));
    // base 32% = 96.000; IRPJ 15% = 14.400 + adicional 10% × 36.000 = 3.600
    expect(t.IRPJ).toBe(R(18_000));
    expect(t.CSLL).toBe(R(8_640)); // 9% × 96.000
  });
});
