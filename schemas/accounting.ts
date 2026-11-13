import { z } from "zod";

import { ACCOUNT_NATURES, ACCOUNT_TYPES } from "@/types/domain";
import { isISODate } from "@/utils/dates";
import { centsToNumber, parseMoneyToCents } from "@/utils/money";

import { optionalText, uuidSchema } from "./common";

const moneyOrZero = z.union([z.string(), z.number()]).transform((v, ctx) => {
  if (v === "" || v === null || v === undefined) return 0;
  const cents = parseMoneyToCents(v);
  if (cents === null || cents < 0) {
    ctx.addIssue({ code: "custom", message: "Valor inválido" });
    return z.NEVER;
  }
  return centsToNumber(cents);
});

export const journalLineSchema = z
  .object({
    account_id: z.string().min(1, "Selecione a conta").pipe(uuidSchema),
    debit: moneyOrZero,
    credit: moneyOrZero,
    memo: optionalText(200, "Histórico da partida"),
  })
  .refine((l) => (l.debit > 0) !== (l.credit > 0), {
    message: "Informe débito OU crédito",
    path: ["debit"],
  });

export const journalEntrySchema = z
  .object({
    entry_date: z.string().trim().refine(isISODate, "Data inválida"),
    description: z.string().trim().min(2, "Informe o histórico").max(300),
    lines: z.array(journalLineSchema).min(2, "Informe ao menos duas partidas").max(60),
  })
  .superRefine((e, ctx) => {
    const d = e.lines.reduce((a, l) => a + Math.round(l.debit * 100), 0);
    const c = e.lines.reduce((a, l) => a + Math.round(l.credit * 100), 0);
    if (d !== c) ctx.addIssue({ code: "custom", message: "Débitos e créditos precisam ser iguais", path: ["lines"] });
  });
export type JournalEntryInput = z.input<typeof journalEntrySchema>;
export type JournalEntryValues = z.output<typeof journalEntrySchema>;

export const accountSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]+(\.[0-9]+)*$/, "Use números separados por ponto, ex.: 5.1.1.20")
    .max(30),
  name: z.string().trim().min(2, "Informe o nome").max(120),
  type: z.enum(ACCOUNT_TYPES, "Selecione o grupo"),
  nature: z.enum(ACCOUNT_NATURES, "Selecione a natureza"),
  is_analytic: z.boolean(),
});
export type AccountInput = z.input<typeof accountSchema>;

export const periodSchema = z
  .object({
    de: z.string().refine(isISODate).optional().catch(undefined),
    ate: z.string().refine(isISODate).optional().catch(undefined),
  })
  .transform((p) => {
    const today = new Date().toISOString().slice(0, 10);
    const to = p.ate ?? today;
    const from = p.de && p.de <= to ? p.de : `${to.slice(0, 4)}-01-01`;
    return { from, to };
  });

export const closePeriodSchema = z.object({
  closed_until: z.string().refine((v) => v === "" || isISODate(v), "Data inválida"),
});
