import type { ClientFormInput } from "@/schemas/company";

export function emptyClientFormValuesForTest() {
  return {
    company: {
      corporate_name: "Tech Alfa Numérica S.A.",
      trade_name: "",
      cnpj: "12.abc.345/01de-35",
      tax_regime: "lucro_presumido",
      state_registration: "",
      municipal_registration: "",
      cnae: "6920-6/01",
      status: "ativa",
      address: { cep: "01310-100", street: "", number: "", complement: "", district: "", city: "São Paulo", state: "SP" },
    },
    client: {
      responsible_name: "Maria",
      email: "Maria@Exemplo.com.br",
      phone: "(11) 99999-8888",
      contract_status: "ativo",
      onboarding_status: "em_andamento",
      notes: "",
    },
    contacts: [{ id: "", name: "João", email: "", phone: "", position: "Financeiro" }],
  } satisfies ClientFormInput as ClientFormInput & {
    company: ClientFormInput["company"] & { address: NonNullable<ClientFormInput["company"]["address"]> };
    client: NonNullable<ClientFormInput["client"]>;
  };
}
