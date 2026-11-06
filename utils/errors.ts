/**
 * Traduz erros do PostgreSQL/PostgREST em mensagens amigáveis, sem expor
 * detalhes internos (nomes de tabelas, políticas, SQL).
 */
export type DbError = { code?: string | null; message?: string | null; details?: string | null };

const CONSTRAINT_MESSAGES: Record<string, string> = {
  companies_org_cnpj_key: "Já existe uma empresa com este CNPJ nesta organização.",
  organizations_slug_key: "Este identificador de organização já está em uso.",
  companies_one_internal_per_org: "A organização já possui um CNPJ interno.",
  organization_members_org_user_key: "Este usuário já é membro da organização.",
  company_members_company_user_key: "Este usuário já possui acesso a esta empresa.",
  client_documents_storage_path_key: "Este arquivo já foi registrado.",
};

const GENERIC_PERMISSION = "Você não tem permissão para realizar esta operação.";
const GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente.";

export function friendlyDbError(error: DbError | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  const message = error.message ?? "";
  const constraint = Object.keys(CONSTRAINT_MESSAGES).find(
    (name) => message.includes(name) || (error.details ?? "").includes(name),
  );
  if (constraint) return CONSTRAINT_MESSAGES[constraint];

  switch (error.code) {
    case "23505":
      return "Registro duplicado.";
    case "23514":
      // Mensagens de regra de negócio lançadas pelos gatilhos (em português).
      if (/proprietário/i.test(message)) return message;
      return "Algum dado não atende às regras de validação (verifique CNPJ, CNAE, e-mail e telefone).";
    case "42501":
      if (/row-level security|permission denied/i.test(message)) return GENERIC_PERMISSION;
      return message || GENERIC_PERMISSION;
    case "28000":
      return "Sessão expirada. Faça login novamente.";
    case "P0002":
    case "22023":
      return message || GENERIC_ERROR;
    case "22P02":
      return "Valor inválido informado.";
    case "PGRST301":
    case "PGRST303":
      return "Sessão expirada. Faça login novamente.";
    default:
      return GENERIC_ERROR;
  }
}
