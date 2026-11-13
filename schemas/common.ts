import { z } from "zod";

import { isValidCnpj, normalizeCnpj } from "@/utils/cnpj";
import { onlyDigits } from "@/utils/format";

/** Texto opcional: aceita vazio e devolve string aparada (vazio -> ""). */
export const optionalText = (max: number, label = "Campo") =>
  z
    .string()
    .trim()
    .max(max, `${label} deve ter no máximo ${max} caracteres`)
    .optional()
    .default("");

export const cnpjSchema = z
  .string()
  .trim()
  .min(1, "Informe o CNPJ")
  .transform(normalizeCnpj)
  .refine(isValidCnpj, "CNPJ inválido");

/** Telefone opcional; armazenado só com dígitos (10 a 13). */
export const phoneSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .transform(onlyDigits)
  .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "Telefone inválido");

export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .default("")
  .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido");

export const cnaeSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .transform(onlyDigits)
  .refine((v) => v === "" || v.length === 7, "CNAE deve ter 7 dígitos");

export const uuidSchema = z.uuid("Identificador inválido");
