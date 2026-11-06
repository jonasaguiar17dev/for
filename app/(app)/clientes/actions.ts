"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrgContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/schemas/common";
import {
  clientFormSchema,
  companyFormSchema,
  toCompanyPayload,
  toContactsPayload,
} from "@/schemas/company";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  companyAccessSchema,
  documentUploadSchema,
} from "@/schemas/organization";
import type { ActionResult } from "@/types/domain";
import { friendlyDbError } from "@/utils/errors";
import { fieldErrors } from "@/utils/validation";

const DENIED = "Você não tem permissão para realizar esta operação.";

function revalidateCompany(companyId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/clientes");
  revalidatePath("/empresas");
  if (companyId) {
    revalidatePath(`/clientes/${companyId}`);
    revalidatePath(`/empresas/${companyId}`);
  }
}

/** Cria (companyId null) ou atualiza cliente + empresa + contatos. */
export async function saveClient(companyId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  if (companyId !== null && !uuidSchema.safeParse(companyId).success) return { ok: false, error: "Empresa inválida." };
  // Criação exige papel global; edição pode ser feita também por gestor da empresa (o RLS decide).
  if (companyId === null && !can(ctx.role, "company:create")) return { ok: false, error: DENIED };

  const parsed = clientFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_company", {
    p_organization_id: ctx.organization.id,
    p_company_id: companyId,
    p_company: toCompanyPayload(parsed.data.company),
    p_client: parsed.data.client,
    p_contacts: toContactsPayload(parsed.data.contacts),
  });
  if (error || !data) return { ok: false, error: friendlyDbError(error) };

  revalidateCompany(data);
  return { ok: true, data: { id: data }, message: companyId ? "Cadastro atualizado." : "Cliente cadastrado." };
}

/** Atualiza somente dados da empresa e contatos (ex.: CNPJ interno). */
export async function saveCompany(companyId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  if (!uuidSchema.safeParse(companyId).success) return { ok: false, error: "Empresa inválida." };

  const parsed = companyFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_company", {
    p_organization_id: ctx.organization.id,
    p_company_id: companyId,
    p_company: toCompanyPayload(parsed.data.company),
    p_client: null,
    p_contacts: toContactsPayload(parsed.data.contacts),
  });
  if (error || !data) return { ok: false, error: friendlyDbError(error) };

  revalidateCompany(data);
  return { ok: true, data: { id: data }, message: "Empresa atualizada." };
}

export async function deleteCompany(companyId: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "company:delete")) return { ok: false, error: DENIED };
  if (!uuidSchema.safeParse(companyId).success) return { ok: false, error: "Empresa inválida." };

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, is_internal")
    .eq("id", companyId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (!company || company.is_internal) return { ok: false, error: "Empresa não encontrada ou não pode ser excluída." };

  // Os arquivos precisam ser removidos antes: depois da exclusão a política do
  // Storage não reconhece mais a empresa e os objetos ficariam órfãos.
  const { data: docs } = await supabase.from("client_documents").select("storage_path").eq("company_id", companyId);
  if (docs?.length) {
    const { error: storageError } = await supabase.storage
      .from("client-documents")
      .remove(docs.map((d) => d.storage_path));
    if (storageError) return { ok: false, error: "Não foi possível remover os documentos da empresa." };
  }

  const { error, count } = await supabase
    .from("companies")
    .delete({ count: "exact" })
    .eq("id", companyId)
    .eq("organization_id", ctx.organization.id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!count) return { ok: false, error: "Empresa não encontrada, interna ou sem permissão de exclusão." };

  revalidateCompany();
  redirect("/clientes");
}

// -----------------------------------------------------------------------------
// Documentos (bucket privado; RLS no Storage e na tabela)
// -----------------------------------------------------------------------------
const documentMetaSchema = documentUploadSchema.extend({
  file_name: z.string().min(1).max(255),
  mime_type: z.enum(ALLOWED_DOCUMENT_MIME_TYPES, "Tipo de arquivo não permitido (use PDF, imagem, Word, Excel ou XML)."),
  size_bytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES, "O arquivo excede o limite de 10 MB."),
});

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-100);
}

/**
 * Passo 1 do upload: valida os metadados e gera uma URL de envio assinada.
 * O próprio Storage recusa a URL se o usuário não puder gravar na empresa (RLS).
 * O arquivo vai direto do navegador ao Storage (sem limite de corpo da Vercel).
 */
export async function prepareDocumentUpload(
  companyId: string,
  input: unknown,
): Promise<ActionResult<{ path: string; token: string }>> {
  const ctx = await requireOrgContext();
  if (!uuidSchema.safeParse(companyId).success) return { ok: false, error: "Empresa inválida." };
  const parsed = documentMetaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Arquivo inválido.", fieldErrors: fieldErrors(parsed.error) };
  }

  const path = `${ctx.organization.id}/${companyId}/${randomUUID()}-${sanitizeFileName(parsed.data.file_name)}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("client-documents").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Sem permissão para enviar documentos desta empresa." };
  return { ok: true, data: { path: data.path, token: data.token } };
}

/** Passo 2 do upload: confirma o arquivo no Storage e registra os metadados. */
export async function finalizeDocumentUpload(
  companyId: string,
  path: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!uuidSchema.safeParse(companyId).success) return { ok: false, error: "Empresa inválida." };
  const prefix = `${ctx.organization.id}/${companyId}/`;
  if (typeof path !== "string" || !path.startsWith(prefix) || path.includes("..")) {
    return { ok: false, error: "Caminho de arquivo inválido." };
  }
  const parsed = documentMetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Metadados inválidos.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: info, error: infoError } = await supabase.storage.from("client-documents").info(path);
  if (infoError || !info) return { ok: false, error: "Arquivo não encontrado no armazenamento." };

  const { error } = await supabase.from("client_documents").insert({
    company_id: companyId,
    document_name: parsed.data.document_name,
    document_type: parsed.data.document_type,
    storage_path: path,
    mime_type: parsed.data.mime_type,
    size_bytes: info.size ?? parsed.data.size_bytes,
    uploaded_by: ctx.user.id,
  });
  if (error) {
    await supabase.storage.from("client-documents").remove([path]);
    return { ok: false, error: friendlyDbError(error) };
  }

  revalidateCompany(companyId);
  return { ok: true, data: undefined, message: "Documento enviado." };
}

export async function getDocumentUrl(documentId: string): Promise<ActionResult<{ url: string }>> {
  await requireOrgContext();
  if (!uuidSchema.safeParse(documentId).success) return { ok: false, error: "Documento inválido." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("client_documents")
    .select("storage_path, document_name")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Documento não encontrado." };

  const { data, error } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(doc.storage_path, 60, { download: doc.document_name });
  if (error || !data) return { ok: false, error: "Não foi possível gerar o link de download." };
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  await requireOrgContext();
  if (!uuidSchema.safeParse(documentId).success) return { ok: false, error: "Documento inválido." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("client_documents")
    .select("storage_path, company_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Documento não encontrado." };

  const { error, count } = await supabase.from("client_documents").delete({ count: "exact" }).eq("id", documentId);
  if (error || !count) return { ok: false, error: error ? friendlyDbError(error) : DENIED };
  await supabase.storage.from("client-documents").remove([doc.storage_path]);

  revalidateCompany(doc.company_id);
  return { ok: true, data: undefined, message: "Documento excluído." };
}

// -----------------------------------------------------------------------------
// Acessos pontuais à empresa (company_members)
// -----------------------------------------------------------------------------
export async function grantCompanyAccess(companyId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "members:manage")) return { ok: false, error: DENIED };
  if (!uuidSchema.safeParse(companyId).success) return { ok: false, error: "Empresa inválida." };

  const parsed = companyAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos informados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_company_member", {
    p_company_id: companyId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };

  revalidateCompany(companyId);
  return { ok: true, data: undefined, message: "Acesso concedido." };
}

export async function revokeCompanyAccess(companyId: string, memberId: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "members:manage")) return { ok: false, error: DENIED };
  if (!uuidSchema.safeParse(memberId).success || !uuidSchema.safeParse(companyId).success) {
    return { ok: false, error: "Registro inválido." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("company_members")
    .delete({ count: "exact" })
    .eq("id", memberId)
    .eq("company_id", companyId);
  if (error || !count) return { ok: false, error: error ? friendlyDbError(error) : DENIED };

  revalidateCompany(companyId);
  return { ok: true, data: undefined, message: "Acesso removido." };
}
