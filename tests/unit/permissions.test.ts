import { describe, expect, it } from "vitest";

import { can, canAssignRole, canEditCompany } from "@/lib/permissions";
import { friendlyDbError } from "@/utils/errors";

describe("matriz de permissões", () => {
  it("contador edita mas não exclui nem gere membros", () => {
    expect(can("accountant", "company:update")).toBe(true);
    expect(can("accountant", "company:delete")).toBe(false);
    expect(can("accountant", "members:manage")).toBe(false);
  });

  it("leitor e colaborador não editam por padrão", () => {
    expect(canEditCompany("viewer")).toBe(false);
    expect(canEditCompany("member")).toBe(false);
    expect(canEditCompany("member", "manager")).toBe(true);
    expect(canEditCompany("member", "viewer")).toBe(false);
    expect(can(null, "company:read_all")).toBe(false);
  });

  it("somente proprietário atribui papel de proprietário", () => {
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "accountant")).toBe(true);
    expect(canAssignRole("accountant", "member")).toBe(false);
  });
});

describe("mensagens de erro do banco", () => {
  it("traduz violações conhecidas sem expor detalhes internos", () => {
    expect(friendlyDbError({ code: "23505", message: 'duplicate key value violates unique constraint "companies_org_cnpj_key"' })).toMatch(
      /CNPJ/,
    );
    expect(friendlyDbError({ code: "42501", message: 'new row violates row-level security policy for table "companies"' })).toBe(
      "Você não tem permissão para realizar esta operação.",
    );
    expect(friendlyDbError({ code: "XX000", message: "internal" })).not.toContain("internal");
  });
});
