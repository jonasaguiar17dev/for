/**
 * Tipos de domínio e rótulos exibidos na interface.
 * Os valores espelham os enums do PostgreSQL (supabase/migrations).
 */

export const ORG_ROLES = ["owner", "admin", "accountant", "viewer", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const MEMBER_STATUSES = ["active", "invited", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const COMPANY_ROLES = ["manager", "viewer"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const TAX_REGIMES = [
  "simples_nacional",
  "mei",
  "lucro_presumido",
  "lucro_real",
  "lucro_arbitrado",
  "imune",
  "isenta",
  "outro",
] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export const COMPANY_STATUSES = ["ativa", "suspensa", "inapta", "baixada", "nula"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const CONTRACT_STATUSES = ["em_implantacao", "ativo", "suspenso", "encerrado"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const ONBOARDING_STATUSES = ["nao_iniciado", "em_andamento", "concluido"] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "contrato_social",
  "alteracao_contratual",
  "cartao_cnpj",
  "procuracao",
  "certidao",
  "contrato_servico",
  "documento_pessoal",
  "outro",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  accountant: "Contador",
  viewer: "Leitor",
  member: "Colaborador",
};

export const ORG_ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Acesso total, inclusive gestão de proprietários.",
  admin: "Acesso total e gestão de membros.",
  accountant: "Lê e edita todas as empresas; não exclui.",
  viewer: "Lê todas as empresas da organização.",
  member: "Acessa somente as empresas às quais for vinculado.",
};

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Ativo",
  invited: "Convidado",
  suspended: "Suspenso",
};

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  manager: "Gestor (edita)",
  viewer: "Leitura",
};

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  simples_nacional: "Simples Nacional",
  mei: "MEI",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  lucro_arbitrado: "Lucro Arbitrado",
  imune: "Imune",
  isenta: "Isenta",
  outro: "Outro",
};

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  ativa: "Ativa",
  suspensa: "Suspensa",
  inapta: "Inapta",
  baixada: "Baixada",
  nula: "Nula",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  em_implantacao: "Em implantação",
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contrato_social: "Contrato social",
  alteracao_contratual: "Alteração contratual",
  cartao_cnpj: "Cartão CNPJ",
  procuracao: "Procuração",
  certidao: "Certidão",
  contrato_servico: "Contrato de serviço",
  documento_pessoal: "Documento pessoal",
  outro: "Outro",
};

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type BrazilianState = (typeof BRAZILIAN_STATES)[number];

export interface Address {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
}

/** Resultado padronizado das Server Actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
