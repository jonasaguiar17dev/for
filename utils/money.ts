/**
 * Valores monetários em reais. Internamente os cálculos usam centavos
 * (inteiros) para evitar erros de ponto flutuante; o banco usa numeric(14,2).
 */
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return brl.format(Number.isFinite(n) ? n : 0);
}

/** "1.234,56" | "1234,56" | "1234.56" | 1234.56 -> 123456 (centavos) ou null se inválido. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  let s = input.trim().replace(/^R\$\s?/, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export const centsToNumber = (cents: number) => Math.round(cents) / 100;

/** Formata para edição em campo de texto: 1234.5 -> "1.234,50". */
export function formatMoneyInput(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";
}

/** Total de itens (quantidade × valor unitário), arredondando cada linha em centavos. */
export function sumItems(items: { quantity: number; unit_amount: number }[]): number {
  return centsToNumber(items.reduce((acc, i) => acc + Math.round(i.quantity * i.unit_amount * 100), 0));
}
