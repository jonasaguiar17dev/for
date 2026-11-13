import { z } from "zod";

import {
  BRAZILIAN_STATES,
  COMPANY_STATUSES,
  CONTRACT_STATUSES,
  ONBOARDING_STATUSES,
  TAX_REGIMES,
} from "@/types/domain";
import { onlyDigits } from "@/utils/format";

import { cnaeSchema, cnpjSchema, optionalEmailSchema, optionalText, phoneSchema, uuidSchema } from "./common";

export const addressSchema = z.object({
  cep: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform(onlyDigits)
    .refine((v) => v === "" || v.length === 8, "CEP deve ter 8 dígitos"),
  street: optionalText(200, "Logradouro"),
  number: optionalText(20, "Número"),
  complement: optionalText(100, "Complemento"),
  district: optionalText(100, "Bairro"),
  city: optionalText(100, "Município"),
  state: z
    .union([z.enum(BRAZILIAN_STATES), z.literal("")])
    .optional()
    .default(""),
});

export const companySchema = z.object({
  corporate_name: z
    .string()
    .trim()
    .min(2, "Informe a razão social")
    .max(200, "Razão social deve ter no máximo 200 caracteres"),
  trade_name: optionalText(200, "Nome fantasia"),
  cnpj: cnpjSchema,
  tax_regime: z.enum(TAX_REGIMES, "Selecione o regime tributário"),
  state_registration: optionalText(20, "Inscrição estadual"),
  municipal_registration: optionalText(20, "Inscrição municipal"),
  cnae: cnaeSchema,
  status: z.enum(COMPANY_STATUSES, "Selecione a situação cadastral").default("ativa"),
  address: addressSchema,
});

export const contactSchema = z.object({
  id: z.union([uuidSchema, z.literal("")]).optional().default(""),
  name: z.string().trim().min(2, "Informe o nome do contato").max(160),
  email: optionalEmailSchema,
  phone: phoneSchema,
  position: optionalText(100, "Cargo"),
});

export const clientDetailsSchema = z.object({
  responsible_name: z
    .string()
    .trim()
    .min(2, "Informe o responsável")
    .max(160, "Nome do responsável muito longo"),
  email: optionalEmailSchema,
  phone: phoneSchema,
  contract_status: z.enum(CONTRACT_STATUSES).default("em_implantacao"),
  onboarding_status: z.enum(ONBOARDING_STATUSES).default("nao_iniciado"),
  notes: optionalText(2000, "Observações"),
});

/** Formulário completo de cliente: empresa + dados do cliente + contatos. */
export const clientFormSchema = z.object({
  company: companySchema,
  client: clientDetailsSchema,
  contacts: z.array(contactSchema).max(20, "Máximo de 20 contatos"),
});

export type ClientFormInput = z.input<typeof clientFormSchema>;
export type ClientFormValues = z.output<typeof clientFormSchema>;

/** Formulário de empresa sem vínculo de cliente (ex.: CNPJ interno). */
export const companyFormSchema = z.object({
  company: companySchema,
  contacts: z.array(contactSchema).max(20, "Máximo de 20 contatos"),
});
export type CompanyFormInput = z.input<typeof companyFormSchema>;
export type CompanyFormValues = z.output<typeof companyFormSchema>;

/** Converte o formulário validado para o payload JSON das RPCs. */
export function toCompanyPayload(company: z.output<typeof companySchema>) {
  return {
    ...company,
    cnae: company.cnae || null,
    address: Object.fromEntries(Object.entries(company.address).filter(([, v]) => v !== "")),
  };
}

export function toContactsPayload(contacts: z.output<typeof contactSchema>[]) {
  return contacts.map(({ id, ...rest }) => (id ? { id, ...rest } : rest));
}

export const clientFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  regime: z.enum(TAX_REGIMES).optional().catch(undefined),
  status: z.enum(CONTRACT_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(1).default(1),
});
export type ClientFilters = z.output<typeof clientFiltersSchema>;

export const companyFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  regime: z.enum(TAX_REGIMES).optional().catch(undefined),
  situacao: z.enum(COMPANY_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(1).default(1),
});
export type CompanyFilters = z.output<typeof companyFiltersSchema>;
