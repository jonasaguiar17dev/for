import type { TrialBalanceRow } from "@/types/database";

/** Movimento do período com o sinal da natureza (devedora: D − C; credora: C − D). */
export const movement = (r: Pick<TrialBalanceRow, "nature" | "debit" | "credit">) =>
  r.nature === "devedora" ? Number(r.debit) - Number(r.credit) : Number(r.credit) - Number(r.debit);

const round = (v: number) => Math.round(v * 100) / 100;
const starts = (code: string, prefix: string) => code === prefix || code.startsWith(`${prefix}.`);

export type DreLine = { key: string; label: string; value: number; kind: "group" | "subtotal" | "result"; sign?: "+" | "-" };

/**
 * DRE do período a partir do balancete (contas analíticas).
 * Receitas 3.1 (bruta), 3.2 (deduções) e demais 3.x (outras receitas/financeiras);
 * custos (grupo 4); despesas 5.2 (financeiras), 5.3 (IRPJ/CSLL) e demais 5.x (operacionais).
 */
export function buildDre(rows: TrialBalanceRow[]): DreLine[] {
  let bruta = 0, deducoes = 0, outras = 0, custos = 0, operacionais = 0, financeiras = 0, tributos = 0;
  for (const r of rows) {
    if (!r.is_analytic) continue;
    const m = movement(r);
    if (r.type === "receita") {
      if (starts(r.code, "3.2")) deducoes += m;
      else if (starts(r.code, "3.1")) bruta += m;
      else outras += m;
    } else if (r.type === "custo") custos += m;
    else if (r.type === "despesa") {
      if (starts(r.code, "5.2")) financeiras += m;
      else if (starts(r.code, "5.3")) tributos += m;
      else operacionais += m;
    }
  }
  const liquida = bruta - deducoes;
  const lucroBruto = liquida - custos;
  const antesIr = lucroBruto - operacionais + outras - financeiras;
  const liquido = antesIr - tributos;
  return [
    { key: "bruta", label: "Receita bruta", value: round(bruta), kind: "group" },
    { key: "deducoes", label: "(−) Deduções da receita", value: round(deducoes), kind: "group", sign: "-" },
    { key: "liquida", label: "Receita líquida", value: round(liquida), kind: "subtotal" },
    { key: "custos", label: "(−) Custos dos serviços e mercadorias", value: round(custos), kind: "group", sign: "-" },
    { key: "lucro_bruto", label: "Lucro bruto", value: round(lucroBruto), kind: "subtotal" },
    { key: "operacionais", label: "(−) Despesas operacionais", value: round(operacionais), kind: "group", sign: "-" },
    { key: "outras", label: "(+) Outras receitas e receitas financeiras", value: round(outras), kind: "group", sign: "+" },
    { key: "financeiras", label: "(−) Despesas financeiras", value: round(financeiras), kind: "group", sign: "-" },
    { key: "antes_ir", label: "Resultado antes do IRPJ e da CSLL", value: round(antesIr), kind: "subtotal" },
    { key: "tributos", label: "(−) IRPJ e CSLL", value: round(tributos), kind: "group", sign: "-" },
    { key: "liquido", label: "Resultado líquido do período", value: round(liquido), kind: "result" },
  ];
}

export type BalanceSheet = {
  ativoCirculante: number;
  ativoNaoCirculante: number;
  ativo: number;
  passivoCirculante: number;
  passivoNaoCirculante: number;
  patrimonioLiquido: number;
  resultadoAcumulado: number;
  passivoMaisPl: number;
  diferenca: number;
};

/**
 * Balanço Patrimonial na data final do balancete (saldos acumulados).
 * O resultado das contas de receita, custo e despesa ainda não transferido ao
 * PL entra como "resultado acumulado do exercício".
 */
export function buildBalanceSheet(rows: TrialBalanceRow[]): BalanceSheet {
  let ac = 0, anc = 0, pc = 0, pnc = 0, pl = 0, resultado = 0;
  for (const r of rows) {
    if (!r.is_analytic) continue;
    const s = Number(r.closing);
    if (r.type === "ativo") {
      // contas redutoras (natureza credora) diminuem o ativo
      const v = r.nature === "devedora" ? s : -s;
      if (starts(r.code, "1.1")) ac += v;
      else anc += v;
    } else if (r.type === "passivo") {
      const v = r.nature === "credora" ? s : -s;
      if (starts(r.code, "2.1")) pc += v;
      else pnc += v;
    } else if (r.type === "patrimonio_liquido") pl += r.nature === "credora" ? s : -s;
    else if (r.type === "receita") resultado += r.nature === "credora" ? s : -s;
    else resultado -= r.nature === "devedora" ? s : -s;
  }
  const ativo = ac + anc;
  const passivoMaisPl = pc + pnc + pl + resultado;
  return {
    ativoCirculante: round(ac),
    ativoNaoCirculante: round(anc),
    ativo: round(ativo),
    passivoCirculante: round(pc),
    passivoNaoCirculante: round(pnc),
    patrimonioLiquido: round(pl),
    resultadoAcumulado: round(resultado),
    passivoMaisPl: round(passivoMaisPl),
    diferenca: round(ativo - passivoMaisPl),
  };
}

/** Código da conta-mãe a partir do código ("5.1.1.20" -> "5.1.1"). */
export function parentCode(code: string): string | null {
  const parts = code.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : null;
}

/** Ordena códigos numericamente por nível ("1.2" antes de "1.10"). */
export function compareCodes(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d) return d;
  }
  return 0;
}
