import type { ClientFormInput } from "@/schemas/company";
import type { ClientContactRow, ClientRow, CompanyRow } from "@/types/database";
import { formatCnpj } from "@/utils/cnpj";
import { formatCep, formatCnae, formatPhone } from "@/utils/format";

/** Converte registros do banco nos valores iniciais do formulário de edição. */
export function toClientFormValues(
  company: CompanyRow,
  client: ClientRow | null,
  contacts: ClientContactRow[],
): ClientFormInput {
  const a = company.address ?? {};
  return {
    company: {
      corporate_name: company.corporate_name,
      trade_name: company.trade_name ?? "",
      cnpj: formatCnpj(company.cnpj),
      tax_regime: company.tax_regime,
      state_registration: company.state_registration ?? "",
      municipal_registration: company.municipal_registration ?? "",
      cnae: formatCnae(company.cnae),
      status: company.status,
      address: {
        cep: formatCep(a.cep),
        street: a.street ?? "",
        number: a.number ?? "",
        complement: a.complement ?? "",
        district: a.district ?? "",
        city: a.city ?? "",
        state: (a.state ?? "") as ClientFormInput["company"]["address"]["state"],
      },
    },
    client: {
      responsible_name: client?.responsible_name ?? "",
      email: client?.email ?? "",
      phone: formatPhone(client?.phone),
      contract_status: client?.contract_status ?? "em_implantacao",
      onboarding_status: client?.onboarding_status ?? "nao_iniciado",
      notes: client?.notes ?? "",
    },
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email ?? "",
      phone: formatPhone(c.phone),
      position: c.position ?? "",
    })),
  };
}
