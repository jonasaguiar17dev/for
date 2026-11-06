/**
 * CNPJ — normalização, validação e formatação.
 *
 * Suporta o CNPJ numérico tradicional e o CNPJ alfanumérico (IN RFB nº
 * 2.229/2024, vigente desde julho/2026): 12 posições alfanuméricas [0-9A-Z]
 * seguidas de 2 dígitos verificadores numéricos. O valor de cada caractere é
 * o código ASCII menos 48 e os DVs são calculados por módulo 11.
 * A mesma regra é aplicada no banco (public.is_valid_cnpj).
 */

const WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Remove máscara e espaços; converte letras para maiúsculas. */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function checkDigit(base: string, weights: number[]): number {
  const sum = weights.reduce((acc, weight, i) => acc + (base.charCodeAt(i) - 48) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Calcula os dois dígitos verificadores para uma base de 12 caracteres. */
export function computeCnpjCheckDigits(base12: string): string {
  const base = normalizeCnpj(base12);
  if (!/^[0-9A-Z]{12}$/.test(base)) throw new Error("Base de CNPJ inválida");
  const d1 = checkDigit(base, WEIGHTS_1);
  const d2 = checkDigit(base + d1, WEIGHTS_2);
  return `${d1}${d2}`;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  return computeCnpjCheckDigits(cnpj.slice(0, 12)) === cnpj.slice(12);
}

/** 12ABC34501DE35 -> 12.ABC.345/01DE-35 (formata parcialmente durante a digitação). */
export function formatCnpj(value: string): string {
  const v = normalizeCnpj(value).slice(0, 14);
  const parts = [v.slice(0, 2), v.slice(2, 5), v.slice(5, 8), v.slice(8, 12), v.slice(12, 14)];
  let out = parts[0];
  if (parts[1]) out += `.${parts[1]}`;
  if (parts[2]) out += `.${parts[2]}`;
  if (parts[3]) out += `/${parts[3]}`;
  if (parts[4]) out += `-${parts[4]}`;
  return out;
}
