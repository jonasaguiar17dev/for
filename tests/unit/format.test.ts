import { describe, expect, it } from "vitest";

import { toCsv } from "@/utils/csv";
import { formatCep, formatCnae, formatPhone, onlyDigits, slugify } from "@/utils/format";
import { safeRedirectPath } from "@/utils/safe-redirect";

describe("formatação", () => {
  it("formata telefone, CEP e CNAE", () => {
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(formatCep("01310100")).toBe("01310-100");
    expect(formatCnae("6920601")).toBe("6920-6/01");
    expect(onlyDigits("(11) 9.9")).toBe("11" + "99");
  });

  it("gera slug sem acentos e símbolos", () => {
    expect(slugify("Aguiar Contabilidade & Gestão")).toBe("aguiar-contabilidade-gestao");
  });
});

describe("safeRedirectPath (proteção contra open redirect)", () => {
  it("aceita caminhos internos", () => {
    expect(safeRedirectPath("/clientes?page=2")).toBe("/clientes?page=2");
  });
  it("rejeita URLs externas e esquemas maliciosos", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });
});

describe("CSV", () => {
  it("escapa separadores e neutraliza fórmulas", () => {
    const csv = toCsv(["a", "b"], [["x;y", "=HYPERLINK(1)"]]);
    expect(csv).toContain('"x;y"');
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv.startsWith("﻿")).toBe(true);
  });
});
