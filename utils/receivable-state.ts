import type { ReceivableStatus } from "@/types/domain";

/** Situação exibida de uma cobrança (derivada do status e do vencimento). */
export type ReceivableState = "pago" | "vencido" | "pendente" | "a_receber" | "cancelado";

export const DUE_SOON_DAYS = 7;

/** Diferença em dias entre duas datas AAAA-MM-DD (aceita também timestamps ISO). */
function daysBetween(fromISO: string, toISO: string) {
  const day = (s: string) => Date.parse(`${String(s).slice(0, 10)}T00:00:00Z`);
  return Math.round((day(toISO) - day(fromISO)) / 86_400_000);
}

export function receivableState(status: ReceivableStatus, dueDate: string, today: string): ReceivableState {
  if (status === "pago") return "pago";
  if (status === "cancelado") return "cancelado";
  const d = daysBetween(today, dueDate);
  if (d < 0) return "vencido";
  if (d <= DUE_SOON_DAYS) return "pendente";
  return "a_receber";
}

/** Texto curto de prazo: "vence hoje", "vence em 3 dias", "há 12 dias". */
export function dueHint(dueDate: string, today: string): string {
  const d = daysBetween(today, dueDate);
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence amanhã";
  if (d > 1) return `vence em ${d} dias`;
  return d === -1 ? "venceu ontem" : `venceu há ${-d} dias`;
}
