import { describe, expect, it } from "vitest";

import { computeCnpjCheckDigits, formatCnpj, isValidCnpj, normalizeCnpj } from "@/utils/cnpj";

describe("CNPJ", () => {
  it("valida CNPJs numéricos com e sem máscara", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("33.000.167/0001-01")).toBe(true);
  });

  it("valida o CNPJ alfanumérico (IN RFB 2.229/2024)", () => {
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12abc34501de35")).toBe(true);
    expect(computeCnpjCheckDigits("12ABC34501DE")).toBe("35");
  });

  it("rejeita dígitos verificadores errados, tamanhos inválidos e sequências repetidas", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("12.ABC.345/01DE-36")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
    // DV não pode ser letra.
    expect(isValidCnpj("12ABC34501DEA5")).toBe(false);
  });

  it("normaliza e formata", () => {
    expect(normalizeCnpj(" 12.abc.345/01de-35 ")).toBe("12ABC34501DE35");
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
    expect(formatCnpj("112223")).toBe("11.222.3");
  });
});
