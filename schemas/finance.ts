import { z } from "zod";

import {
  ADJUSTMENT_INDEXES,
  BILLING_FREQUENCIES,
  CONTRACT_STATES,
  PAYMENT_METHODS,
  RECEIVABLE_FILTERS,
} from "@/types/domain";
import { isISODate } from "@/utils/dates";
import { centsToNumber, parseMoneyToCents } from "@/utils/money";

import { optionalText, uuidSchema } from "./common";

/** Valor em reais digitado como texto ("1.234,56"); resultado em número com 2 casas. */
const money = (label: string, { allowZero = true } = {}) =>
  z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const cents = parseMoneyToCents(v);
      if (cents === null || cents < 0 || (!allowZero && cents === 0)) {
        ctx.addIssue({ code: "custom", message: `${label} inválido` });
        return z.NEVER;
      }
      if (cents > 99_999_999_999) {
        ctx.addIssue({ code: "custom", message: `${label} muito alto` });
        return z.NEVER;
      }
      return centsToNumber(cents);
    });

const isoDate = (label: string) =>
  z.string().trim().refine(isISODate, `${label} inválida`);

const optionalIsoDate = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || isISODate(v), `${label} inválida`);

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço").max(120),
  description: optionalText(500, "Descrição"),
  default_amount: money("Valor"),
  billing_frequency: z.enum(BILLING_FREQUENCIES),
  active: z.boolean().default(true),
});
export type ServiceInput = z.input<typeof serviceSchema>;

export const contractItemSchema = z.object({
  id: z.union([uuidSchema, z.literal("")]).optional().default(""),
  service_id: z.union([uuidSchema, z.literal("")]).optional().default(""),
  description: z.string().trim().min(2, "Descreva o serviço").max(200),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => Number(String(v).replace(",", ".")))
    .refine((n) => Number.isFinite(n) && n > 0 && n <= 100000, "Quantidade inválida"),
  unit_amount: money("Valor"),
  billing_frequency: z.enum(BILLING_FREQUENCIES),
});

export const contractFormSchema = z
  .object({
    company_id: z.string().min(1, "Selecione o cliente").pipe(uuidSchema),
    status: z.enum(CONTRACT_STATES).default("ativo"),
    start_date: isoDate("Data de início"),
    end_date: optionalIsoDate("Data de término"),
    billing_day: z.coerce.number().int().min(1, "Dia entre 1 e 28").max(28, "Dia entre 1 e 28"),
    adjustment_index: z.enum(ADJUSTMENT_INDEXES).default("nenhum"),
    adjustment_month: z
      .union([z.coerce.number().int().min(1).max(12), z.literal("")])
      .optional()
      .default(""),
    notes: optionalText(2000, "Observações"),
    items: z.array(contractItemSchema).min(1, "Inclua ao menos um serviço").max(30),
  })
  .refine((d) => !d.end_date || d.end_date >= d.start_date, {
    message: "O término deve ser depois do início",
    path: ["end_date"],
  })
  .refine((d) => d.adjustment_index === "nenhum" || d.adjustment_month !== "", {
    message: "Informe o mês do reajuste",
    path: ["adjustment_month"],
  });
export type ContractFormInput = z.input<typeof contractFormSchema>;
export type ContractFormValues = z.output<typeof contractFormSchema>;

export function toContractPayload(v: ContractFormValues) {
  const { items, ...contract } = v;
  return {
    contract: {
      ...contract,
      end_date: contract.end_date || null,
      adjustment_month: contract.adjustment_index === "nenhum" ? null : contract.adjustment_month || null,
    },
    items: items.map(({ id, service_id, ...rest }) => ({
      ...(id ? { id } : {}),
      ...(service_id ? { service_id } : {}),
      ...rest,
    })),
  };
}

/** Cobrança avulsa (fora do faturamento automático). */
export const receivableSchema = z.object({
  company_id: uuidSchema,
  description: z.string().trim().min(2, "Descreva a cobrança").max(200),
  competence: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Competência inválida")
    .transform((v) => `${v}-01`),
  due_date: isoDate("Vencimento"),
  amount: money("Valor", { allowZero: false }),
  notes: optionalText(1000, "Observações"),
});
export type ReceivableInput = z.input<typeof receivableSchema>;

export const paymentSchema = z.object({
  paid_at: isoDate("Data do pagamento"),
  paid_amount: money("Valor pago", { allowZero: false }),
  payment_method: z.enum(PAYMENT_METHODS, "Selecione a forma de pagamento"),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const competenceSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Competência inválida")
  .transform((v) => `${v}-01`);

export const receivableFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(RECEIVABLE_FILTERS).optional().catch(undefined),
  competencia: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(1).default(1),
});

export const contractFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(CONTRACT_STATES).optional().catch(undefined),
});
