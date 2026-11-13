/**
 * Apuração de tributos — funções puras, usadas no navegador (prévia) e no
 * servidor (valor gravado). Valores em centavos (inteiros).
 *
 * Simples Nacional: LC 123/2006, Anexos I a V (redação da LC 155/2016,
 * vigente desde 2018). Alíquota efetiva = (RBT12 × alíquota nominal − parcela a
 * deduzir) ÷ RBT12. Repartição por tributo conforme a tabela de cada faixa, com
 * teto de 5% para o ISS e redistribuição proporcional da diferença aos tributos
 * federais.
 *
 * Lucro Presumido: PIS 0,65% e COFINS 3% (cumulativos) mensais; ISS pela
 * alíquota municipal informada; IRPJ (15% + adicional de 10% sobre a base que
 * exceder R$ 20 mil por mês do período) e CSLL (9%) trimestrais, sobre as bases
 * presumidas de cada atividade.
 */

export const SIMPLES_ANNEXES = ["I", "II", "III", "IV", "V", "FATOR_R"] as const;
export type SimplesAnnex = (typeof SIMPLES_ANNEXES)[number];
export const SIMPLES_ANNEX_LABELS: Record<SimplesAnnex, string> = {
  I: "Anexo I — Comércio",
  II: "Anexo II — Indústria",
  III: "Anexo III — Serviços",
  IV: "Anexo IV — Serviços (CPP fora do DAS)",
  V: "Anexo V — Serviços",
  FATOR_R: "Anexo III ou V — pelo Fator R",
};

export const SIMPLES_LIMIT = 480_000_000; // R$ 4,8 milhões
export const SIMPLES_SUBLIMIT = 360_000_000; // R$ 3,6 milhões (ICMS/ISS fora do DAS acima disso)
export const FATOR_R_MIN = 0.28;

type Faixa = { ate: number; aliquota: number; deduzir: number; reparticao: Record<string, number> };

const f = (ate: number, aliquota: number, deduzir: number, reparticao: Record<string, number>): Faixa => ({
  ate: ate * 100,
  aliquota,
  deduzir: deduzir * 100,
  reparticao,
});
const r1 = (IRPJ: number, CSLL: number, COFINS: number, PIS: number, CPP: number, ICMS: number) => ({ IRPJ, CSLL, COFINS, PIS, CPP, ICMS });
const r2 = (IRPJ: number, CSLL: number, COFINS: number, PIS: number, CPP: number, IPI: number, ICMS: number) => ({ IRPJ, CSLL, COFINS, PIS, CPP, IPI, ICMS });
const r3 = (IRPJ: number, CSLL: number, COFINS: number, PIS: number, CPP: number, ISS: number) => ({ IRPJ, CSLL, COFINS, PIS, CPP, ISS });
const r4 = (IRPJ: number, CSLL: number, COFINS: number, PIS: number, ISS: number) => ({ IRPJ, CSLL, COFINS, PIS, ISS });

export const SIMPLES_TABLES: Record<Exclude<SimplesAnnex, "FATOR_R">, Faixa[]> = {
  I: [
    f(180_000, 4, 0, r1(5.5, 3.5, 12.74, 2.76, 41.5, 34)),
    f(360_000, 7.3, 5_940, r1(5.5, 3.5, 12.74, 2.76, 41.5, 34)),
    f(720_000, 9.5, 13_860, r1(5.5, 3.5, 12.74, 2.76, 42, 33.5)),
    f(1_800_000, 10.7, 22_500, r1(5.5, 3.5, 12.74, 2.76, 42, 33.5)),
    f(3_600_000, 14.3, 87_300, r1(5.5, 3.5, 12.74, 2.76, 42, 33.5)),
    f(4_800_000, 19, 378_000, r1(13.5, 10, 28.27, 6.13, 42.1, 0)),
  ],
  II: [
    f(180_000, 4.5, 0, r2(5.5, 3.5, 11.51, 2.49, 37.5, 7.5, 32)),
    f(360_000, 7.8, 5_940, r2(5.5, 3.5, 11.51, 2.49, 37.5, 7.5, 32)),
    f(720_000, 10, 13_860, r2(5.5, 3.5, 11.51, 2.49, 37.5, 7.5, 32)),
    f(1_800_000, 11.2, 22_500, r2(5.5, 3.5, 11.51, 2.49, 37.5, 7.5, 32)),
    f(3_600_000, 14.7, 85_500, r2(5.5, 3.5, 11.51, 2.49, 37.5, 7.5, 32)),
    f(4_800_000, 30, 720_000, r2(8.5, 7.5, 20.96, 4.54, 23.5, 35, 0)),
  ],
  III: [
    f(180_000, 6, 0, r3(4, 3.5, 12.82, 2.78, 43.4, 33.5)),
    f(360_000, 11.2, 9_360, r3(4, 3.5, 14.05, 3.05, 43.4, 32)),
    f(720_000, 13.5, 17_640, r3(4, 3.5, 13.64, 2.96, 43.4, 32.5)),
    f(1_800_000, 16, 35_640, r3(4, 3.5, 13.64, 2.96, 43.4, 32.5)),
    f(3_600_000, 21, 125_640, r3(4, 3.5, 12.82, 2.78, 43.4, 33.5)),
    f(4_800_000, 33, 648_000, r3(35, 15, 16.03, 3.47, 30.5, 0)),
  ],
  IV: [
    f(180_000, 4.5, 0, r4(18.8, 15.2, 17.67, 3.83, 44.5)),
    f(360_000, 9, 8_100, r4(19.8, 15.2, 20.55, 4.45, 40)),
    f(720_000, 10.2, 12_420, r4(20.8, 15.2, 19.73, 4.27, 40)),
    f(1_800_000, 14, 39_780, r4(17.8, 19.2, 18.9, 4.1, 40)),
    f(3_600_000, 22, 183_780, r4(18.8, 19.2, 18.08, 3.92, 40)),
    f(4_800_000, 33, 828_000, r4(53.5, 21.5, 20.55, 4.45, 0)),
  ],
  V: [
    f(180_000, 15.5, 0, r3(25, 15, 14.1, 3.05, 28.85, 14)),
    f(360_000, 18, 4_500, r3(23, 15, 14.1, 3.05, 27.85, 17)),
    f(720_000, 19.5, 9_900, r3(24, 15, 14.92, 3.23, 23.85, 19)),
    f(1_800_000, 20.5, 17_100, r3(21, 15, 15.74, 3.41, 23.85, 21)),
    f(3_600_000, 23, 62_100, r3(23, 12.5, 14.1, 3.05, 23.85, 23.5)),
    f(4_800_000, 30.5, 540_000, r3(35, 15.5, 16.44, 3.56, 29.5, 0)),
  ],
};

export type SimplesActivity = { annex: SimplesAnnex; revenue: number /* centavos */ };
export type SimplesInput = { rbt12: number; payroll12: number; activities: SimplesActivity[] };

export type TaxLine = { tax: string; amount: number };
export type SimplesActivityResult = {
  annex: SimplesAnnex;
  appliedAnnex: Exclude<SimplesAnnex, "FATOR_R">;
  revenue: number;
  faixa: number;
  nominalRate: number;
  effectiveRate: number; // em %, com 4 casas
  amount: number;
  taxes: TaxLine[];
};
export type SimplesResult = {
  ok: true;
  rbt12Used: number;
  rbt12Projected: boolean;
  fatorR: number | null;
  activities: SimplesActivityResult[];
  taxes: TaxLine[];
  total: number;
  warnings: string[];
};
export type TaxError = { ok: false; error: string };

/** Distribui um total em centavos conforme pesos, garantindo soma exata. */
function split(total: number, weights: Record<string, number>): TaxLine[] {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const sum = entries.reduce((a, [, w]) => a + w, 0);
  const lines = entries.map(([tax, w]) => ({ tax, amount: Math.floor((total * w) / sum), rest: ((total * w) / sum) % 1 }));
  let left = total - lines.reduce((a, l) => a + l.amount, 0);
  for (const l of [...lines].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    l.amount += 1;
    left -= 1;
  }
  return lines.map(({ tax, amount }) => ({ tax, amount }));
}

/** Percentuais efetivos por tributo, aplicando o teto de 5% do ISS. */
export function simplesShares(reparticao: Record<string, number>, effectiveRate: number): Record<string, number> {
  const shares = { ...reparticao };
  const iss = shares.ISS ?? 0;
  if (iss > 0 && (effectiveRate * iss) / 100 > 5) {
    const capped = (5 / effectiveRate) * 100; // parcela do ISS que resulta em 5%
    const excess = iss - capped;
    const federal = Object.keys(shares).filter((k) => k !== "ISS");
    const fedSum = federal.reduce((a, k) => a + shares[k], 0);
    for (const k of federal) shares[k] += (excess * shares[k]) / fedSum;
    shares.ISS = capped;
  }
  return shares;
}

/**
 * receita × (RBT12 × alíquota − PD) ÷ RBT12, em aritmética inteira exata
 * (centavos, alíquota em milésimos de ponto percentual), arredondando meio centavo para cima.
 */
function exactAmount(revenue: number, rbt12: number, aliquota: number, deduzir: number): number {
  const num = BigInt(revenue) * (BigInt(rbt12) * BigInt(Math.round(aliquota * 1000)) - BigInt(deduzir) * BigInt(100000));
  const den = BigInt(rbt12) * BigInt(100000);
  return Number((num * BigInt(2) + den) / (den * BigInt(2)));
}

export function calcSimples(input: SimplesInput): SimplesResult | TaxError {
  const acts = input.activities.filter((a) => a.revenue > 0);
  const monthRevenue = acts.reduce((a, x) => a + x.revenue, 0);
  if (!acts.length) return { ok: false, error: "Informe a receita do mês em ao menos uma atividade." };
  const warnings: string[] = [];
  let rbt12 = input.rbt12;
  let projected = false;
  if (rbt12 <= 0) {
    // Início de atividade: RBT12 proporcional (receita do mês × 12).
    rbt12 = monthRevenue * 12;
    projected = true;
    warnings.push("Sem receita nos 12 meses anteriores: RBT12 proporcional (receita do mês × 12), regra do início de atividade.");
  }
  if (rbt12 > SIMPLES_LIMIT) return { ok: false, error: "RBT12 acima de R$ 4,8 milhões: a empresa excede o limite do Simples Nacional." };
  if (rbt12 > SIMPLES_SUBLIMIT)
    warnings.push("RBT12 acima do sublimite de R$ 3,6 milhões: ICMS e ISS são recolhidos fora do DAS e não estão neste cálculo.");

  const fatorR = rbt12 > 0 && input.payroll12 >= 0 ? input.payroll12 / rbt12 : null;
  const results: SimplesActivityResult[] = acts.map((a) => {
    const applied = a.annex === "FATOR_R" ? ((fatorR ?? 0) >= FATOR_R_MIN ? "III" : "V") : a.annex;
    const table = SIMPLES_TABLES[applied];
    const idx = table.findIndex((x) => rbt12 <= x.ate);
    const fx = table[idx];
    const eff = ((rbt12 * fx.aliquota) / 100 - fx.deduzir) / rbt12; // fração
    const effectiveRate = Math.round(eff * 100 * 10000) / 10000;
    const amount = exactAmount(a.revenue, rbt12, fx.aliquota, fx.deduzir);
    // Na 6ª faixa (acima do sublimite) a tabela já não tem ICMS/ISS: são recolhidos fora do DAS.
    const shares = simplesShares(fx.reparticao, eff * 100);
    return {
      annex: a.annex,
      appliedAnnex: applied,
      revenue: a.revenue,
      faixa: idx + 1,
      nominalRate: fx.aliquota,
      effectiveRate,
      amount,
      taxes: split(amount, shares),
    };
  });
  if (results.some((r) => r.appliedAnnex === "IV")) warnings.push("Anexo IV: a CPP (INSS patronal) é recolhida em GPS/DCTFWeb, fora do DAS.");

  const byTax = new Map<string, number>();
  for (const r of results) for (const t of r.taxes) byTax.set(t.tax, (byTax.get(t.tax) ?? 0) + t.amount);
  const order = ["IRPJ", "CSLL", "COFINS", "PIS", "CPP", "IPI", "ICMS", "ISS"];
  return {
    ok: true,
    rbt12Used: rbt12,
    rbt12Projected: projected,
    fatorR: input.activities.some((a) => a.annex === "FATOR_R") ? fatorR : null,
    activities: results,
    taxes: order.filter((t) => byTax.has(t)).map((tax) => ({ tax, amount: byTax.get(tax)! })),
    total: results.reduce((a, r) => a + r.amount, 0),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Lucro Presumido
// ---------------------------------------------------------------------------
export const PRESUMIDO_ACTIVITIES = {
  comercio_industria: { label: "Comércio e indústria", irpj: 8, csll: 12, service: false },
  servicos: { label: "Prestação de serviços em geral", irpj: 32, csll: 32, service: true },
  transporte_cargas: { label: "Transporte de cargas", irpj: 8, csll: 12, service: true },
  transporte_passageiros: { label: "Transporte de passageiros", irpj: 16, csll: 12, service: true },
  servicos_hospitalares: { label: "Serviços hospitalares (requisitos legais)", irpj: 8, csll: 12, service: true },
  revenda_combustiveis: { label: "Revenda de combustíveis", irpj: 1.6, csll: 12, service: false },
} as const;
export type PresumidoActivity = keyof typeof PRESUMIDO_ACTIVITIES;
export const PRESUMIDO_ACTIVITY_KEYS = Object.keys(PRESUMIDO_ACTIVITIES) as PresumidoActivity[];

export type PresumidoInput = {
  competence: string; // AAAA-MM-01
  issRate: number; // % (2 a 5)
  activities: { activity: PresumidoActivity; revenue: number; quarterRevenue: number }[];
};
export type PresumidoResult = {
  ok: true;
  quarterEnd: boolean;
  monthRevenue: number;
  irpjBase: number;
  csllBase: number;
  taxes: TaxLine[];
  total: number;
  warnings: string[];
};

export const isQuarterEnd = (competence: string) => [3, 6, 9, 12].includes(Number(competence.slice(5, 7)));

export function calcPresumido(input: PresumidoInput): PresumidoResult | TaxError {
  const acts = input.activities.filter((a) => a.revenue > 0 || a.quarterRevenue > 0);
  if (!acts.length) return { ok: false, error: "Informe a receita em ao menos uma atividade." };
  if (!(input.issRate >= 0 && input.issRate <= 5)) return { ok: false, error: "Alíquota de ISS deve estar entre 0% e 5%." };
  const month = acts.reduce((a, x) => a + x.revenue, 0);
  const serviceRevenue = acts.filter((a) => PRESUMIDO_ACTIVITIES[a.activity].service).reduce((s, a) => s + a.revenue, 0);
  const taxes: TaxLine[] = [
    { tax: "PIS", amount: Math.round(month * 0.0065) },
    { tax: "COFINS", amount: Math.round(month * 0.03) },
  ];
  if (serviceRevenue > 0 && input.issRate > 0) taxes.push({ tax: "ISS", amount: Math.round((serviceRevenue * input.issRate) / 100) });
  const quarterEnd = isQuarterEnd(input.competence);
  let irpjBase = 0;
  let csllBase = 0;
  const warnings: string[] = [];
  if (quarterEnd) {
    irpjBase = Math.round(acts.reduce((s, a) => s + (a.quarterRevenue * PRESUMIDO_ACTIVITIES[a.activity].irpj) / 100, 0));
    csllBase = Math.round(acts.reduce((s, a) => s + (a.quarterRevenue * PRESUMIDO_ACTIVITIES[a.activity].csll) / 100, 0));
    const adicional = Math.max(0, irpjBase - 6_000_000) * 0.1; // R$ 60 mil por trimestre
    taxes.push({ tax: "IRPJ", amount: Math.round(irpjBase * 0.15 + adicional) });
    taxes.push({ tax: "CSLL", amount: Math.round(csllBase * 0.09) });
    warnings.push("IRPJ e CSLL trimestrais: base presumida sobre a receita do trimestre. Podem ser pagos em cota única ou em até 3 quotas.");
  } else {
    warnings.push("IRPJ e CSLL são apurados no fim do trimestre (março, junho, setembro e dezembro).");
  }
  warnings.push("Para receita anual acima de R$ 5 milhões, confira o acréscimo de presunção previsto na LC 224/2025.");
  return { ok: true, quarterEnd, monthRevenue: month, irpjBase, csllBase, taxes, total: taxes.reduce((s, t) => s + t.amount, 0), warnings };
}

/** Contas do plano padrão usadas na contabilização de cada tributo. */
export const TAX_POSTING: Record<string, { debit: string; credit: string }> = {
  DAS: { debit: "3.2.1.01", credit: "2.1.3.01" },
  PIS: { debit: "3.2.1.01", credit: "2.1.3.04" },
  COFINS: { debit: "3.2.1.01", credit: "2.1.3.05" },
  ISS: { debit: "3.2.1.01", credit: "2.1.3.06" },
  IRPJ: { debit: "5.3.1.01", credit: "2.1.3.02" },
  CSLL: { debit: "5.3.1.02", credit: "2.1.3.03" },
};

/** Vencimento do DAS: dia 20 do mês seguinte à competência (prorroga se não for dia útil). */
export function dasDueDate(competence: string): string {
  const [y, m] = competence.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 20));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function lastDayOf(competence: string): string {
  const [y, m] = competence.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export type TaxCalc = (SimplesResult & { regime: "simples_nacional" }) | (PresumidoResult & { regime: "lucro_presumido" });

/** Executa o cálculo a partir dos valores validados do formulário. */
export function runTaxCalc(
  v:
    | { regime: "simples_nacional"; competence: string; rbt12: number; payroll12: number; activities: { annex: SimplesAnnex; revenue: number }[] }
    | { regime: "lucro_presumido"; competence: string; iss_rate: number; activities: { activity: string; revenue: number; quarter_revenue: number }[] },
): TaxCalc | TaxError {
  if (v.regime === "simples_nacional") {
    const r = calcSimples({ rbt12: v.rbt12, payroll12: v.payroll12, activities: v.activities });
    return r.ok ? { ...r, regime: "simples_nacional" } : r;
  }
  const r = calcPresumido({
    competence: v.competence,
    issRate: v.iss_rate,
    activities: v.activities.map((a) => ({ activity: a.activity as PresumidoActivity, revenue: a.revenue, quarterRevenue: a.quarter_revenue })),
  });
  return r.ok ? { ...r, regime: "lucro_presumido" } : r;
}

/** Partidas do lançamento contábil da apuração (valores em centavos). */
export function taxPostingLines(calc: TaxCalc): { debit: string; credit: string; amount: number; memo: string }[] {
  if (calc.regime === "simples_nacional") return calc.total > 0 ? [{ ...TAX_POSTING.DAS, amount: calc.total, memo: "DAS — Simples Nacional" }] : [];
  return calc.taxes.filter((t) => t.amount > 0).map((t) => ({ ...TAX_POSTING[t.tax], amount: t.amount, memo: t.tax }));
}
