import { z } from "zod";

import { COMPANY_ROLES, DOCUMENT_TYPES, ORG_ROLES } from "@/types/domain";

import { companySchema } from "./company";

export const organizationSetupSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da organização").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Informe o identificador")
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens"),
  company: companySchema,
});
export type OrganizationSetupInput = z.input<typeof organizationSetupSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido")),
  role: z.enum(ORG_ROLES, "Selecione o papel"),
});
export type AddMemberInput = z.input<typeof addMemberSchema>;

export const companyAccessSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido")),
  role: z.enum(COMPANY_ROLES, "Selecione o acesso"),
});
export type CompanyAccessInput = z.input<typeof companyAccessSchema>;

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "text/xml",
  "application/xml",
] as const;

export const documentUploadSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES, "Selecione o tipo de documento"),
  document_name: z.string().trim().min(1, "Informe o nome do documento").max(200),
});
