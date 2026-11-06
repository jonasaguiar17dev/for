import { describe, expect, it } from "vitest";

import { emptyClientFormValuesForTest } from "./fixtures";
import { resetPasswordSchema } from "@/schemas/auth";
import { clientFiltersSchema, clientFormSchema, toCompanyPayload, toContactsPayload } from "@/schemas/company";

describe("clientFormSchema", () => {
  it("normaliza CNPJ, CNAE, CEP e telefones", () => {
    const parsed = clientFormSchema.parse(emptyClientFormValuesForTest());
    expect(parsed.company.cnpj).toBe("12ABC34501DE35");
    expect(parsed.company.cnae).toBe("6920601");
    expect(parsed.company.address.cep).toBe("01310100");
    expect(parsed.client.phone).toBe("11999998888");
    expect(parsed.client.email).toBe("maria@exemplo.com.br");
  });

  it("rejeita CNPJ inválido, CNAE incompleto e e-mail inválido", () => {
    const input = emptyClientFormValuesForTest();
    input.company.cnpj = "11.222.333/0001-00";
    input.company.cnae = "6920";
    input.client.email = "nao-e-email";
    const result = clientFormSchema.safeParse(input);
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["company.cnpj", "company.cnae", "client.email"]));
  });

  it("exige razão social, regime e responsável", () => {
    const input = emptyClientFormValuesForTest();
    input.company.corporate_name = "";
    input.company.tax_regime = "" as never;
    input.client.responsible_name = " ";
    const result = clientFormSchema.safeParse(input);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining(["company.corporate_name", "company.tax_regime", "client.responsible_name"]),
    );
  });

  it("monta payload sem campos vazios de endereço e sem id em contatos novos", () => {
    const parsed = clientFormSchema.parse(emptyClientFormValuesForTest());
    const payload = toCompanyPayload(parsed.company);
    expect(payload.address).toEqual({ cep: "01310100", city: "São Paulo", state: "SP" });
    expect(toContactsPayload(parsed.contacts)[0]).not.toHaveProperty("id");
  });
});

describe("filtros da listagem", () => {
  it("ignora valores inválidos vindos da URL", () => {
    expect(clientFiltersSchema.parse({ regime: "x", status: "y", page: "-3" })).toEqual({
      q: undefined,
      regime: undefined,
      status: undefined,
      page: 1,
    });
    expect(clientFiltersSchema.parse({ regime: "lucro_real", page: "2" }).page).toBe(2);
  });
});

describe("política de senha", () => {
  it("exige senha forte e confirmação igual", () => {
    expect(resetPasswordSchema.safeParse({ password: "fraca", confirmPassword: "fraca" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "SenhaForte123", confirmPassword: "Outra" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "SenhaForte123", confirmPassword: "SenhaForte123" }).success).toBe(true);
  });
});
