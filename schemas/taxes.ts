import { z } from "zod";

import { parseMoneyToCents } from "@/utils/money";
import { PRESUMIDO_ACTIVITY_KEYS, SIMPLES_ANNEXES } from "@/utils/taxes";

/** Valor em reais (texto "1.234,56" ou número) → centavos. Vazio = 0. */
const cents = z.union([z.string(), z.number()]).transform((v, ctx) => {
  if (v === "" || v === null || v === undefined) return 0;
  const c = parseMoneyToCents(v);
  if (c === null || c < 0) {
    ctx.addIssue({ code: "custom", message: "Valor inválido" });
    return z.NEVER;
  }
  return c;
});

const competence = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida")
  .transform((v) => `${v}-01`);

export const simplesFormSchema = z.object({
  regime: z.literal("simples_nacional"),
  competence,
  rbt12: cents,
  payroll12: cents,
  activities: z
    .array(z.object({ annex: z.enum(SIMPLES_ANNEXES, "Selecione o anexo"), revenue: cents }))
    .min(1)
    .max(8),
});

export const presumidoFormSchema = z.object({
  regime: z.literal("lucro_presumido"),
  competence,
  iss_rate: z.union([z.string(), z.number()]).transform((v, ctx) => {
    const n = Number(String(v ?? "").replace(",", ".") || 0);
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      ctx.addIssue({ code: "custom", message: "Entre 0% e 5%" });
      return z.NEVER;
    }
    return n;
  }),
  activities: z
    .array(z.object({ activity: z.enum(PRESUMIDO_ACTIVITY_KEYS as [string, ...string[]], "Selecione a atividade"), revenue: cents, quarter_revenue: cents }))
    .min(1)
    .max(8),
});

export const taxFormSchema = z.discriminatedUnion("regime", [simplesFormSchema, presumidoFormSchema]);
export type TaxFormInput = z.input<typeof taxFormSchema>;
export type TaxFormValues = z.output<typeof taxFormSchema>;
