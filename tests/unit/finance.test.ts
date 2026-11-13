import { describe, expect, it } from "vitest";

import { contractFormSchema, paymentSchema, receivableSchema, toContractPayload } from "@/schemas/finance";
import { formatCompetence, formatISODate, isISODate, monthStart } from "@/utils/dates";
import { formatBRL, formatMoneyInput, parseMoneyToCents, sumItems } from "@/utils/money";

describe("dinheiro", () => {
  it("interpreta valores no formato brasileiro e internacional", () => {
    expect(parseMoneyToCents("1.234,56")).toBe(123456);
    expect(parseMoneyToCents("1234,5")).toBe(123450);
    expect(parseMoneyToCents("R$ 850,00")).toBe(85000);
    expect(parseMoneyToCents("1234.56")).toBe(123456);
    expect(parseMoneyToCents("1.000")).toBe(100000);
    expect(parseMoneyToCents(45.5)).toBe(4550);
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("1,234,56")).toBeNull();
  });

  it("soma itens em centavos sem erro de ponto flutuante", () => {
    expect(sumItems([{ quantity: 3, unit_amount: 0.1 }, { quantity: 1, unit_amount: 0.2 }])).toBe(0.5);
    expect(sumItems([{ quantity: 3, unit_amount: 45.5 }, { quantity: 1, unit_amount: 850 }])).toBe(986.5);
  });

  it("formata em reais", () => {
    expect(formatBRL(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(formatMoneyInput(850)).toBe("850,00");
  });
});

describe("datas", () => {
  it("valida e formata datas sem fuso", () => {
    expect(isISODate("2027-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(formatISODate("2027-01-10")).toBe("10/01/2027");
    expect(formatCompetence("2027-01-01")).toBe("01/2027");
    expect(monthStart("2027-03-17")).toBe("2027-03-01");
  });
});

const baseContract = {
  company_id: "00000000-0000-4000-8000-000000000001",
  status: "ativo",
  start_date: "2027-01-01",
  end_date: "",
  billing_day: "10",
  adjustment_index: "nenhum",
  adjustment_month: "",
  notes: "",
  items: [{ id: "", service_id: "", description: "Contabilidade", quantity: "1", unit_amount: "850,00", billing_frequency: "mensal" }],
} as const;

describe("contrato", () => {
  it("converte valores e monta o payload", () => {
    const parsed = contractFormSchema.parse(baseContract);
    const payload = toContractPayload(parsed);
    expect(payload.items[0]).toEqual({ description: "Contabilidade", quantity: 1, unit_amount: 850, billing_frequency: "mensal" });
    expect(payload.contract.end_date).toBeNull();
    expect(payload.contract.adjustment_month).toBeNull();
    expect(payload.contract.billing_day).toBe(10);
  });

  it("exige cliente, itens, término após início e mês do reajuste", () => {
    const r = contractFormSchema.safeParse({
      ...baseContract,
      company_id: "",
      end_date: "2026-12-31",
      adjustment_index: "ipca",
      billing_day: "31",
      items: [],
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["company_id", "items", "billing_day"]));
  });

  it("valida término e reajuste quando o resto está correto", () => {
    const r = contractFormSchema.safeParse({ ...baseContract, end_date: "2026-12-31", adjustment_index: "ipca" });
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["end_date", "adjustment_month"]));
  });
});

describe("cobranças e pagamentos", () => {
  it("normaliza competência e recusa valor zero", () => {
    const ok = receivableSchema.parse({
      company_id: baseContract.company_id,
      description: "Alteração contratual",
      competence: "2027-03",
      due_date: "2027-03-15",
      amount: "450,00",
    });
    expect(ok.competence).toBe("2027-03-01");
    expect(ok.amount).toBe(450);
    expect(receivableSchema.safeParse({ ...ok, competence: "2027-03", amount: "0" }).success).toBe(false);
  });

  it("exige data, valor e forma de pagamento", () => {
    expect(paymentSchema.safeParse({ paid_at: "2027-03-15", paid_amount: "450,00", payment_method: "pix" }).success).toBe(true);
    expect(paymentSchema.safeParse({ paid_at: "15/03/2027", paid_amount: "0", payment_method: "cheque" }).success).toBe(false);
  });
});
